import React, { useState, useRef, useEffect } from 'react';
import type { Agent, ChatMessage } from '../types';
import Session, { LoadingStatus } from '../services/sessionService';
import { sessionManager } from '../services/sessionManager';
import { SendIcon, UserIcon, BotIcon, SpinnerIcon, TransferIcon, FileUploadIcon, ToolIcon } from './icons';

import { causeError } from '../services/agentService';

interface ChatInterfaceProps {
  agent: Agent | null;
}

const ChatBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
    const isUser = message.role === 'user';
    const isTool = message.role === 'tool';

    const getIcon = () => {
        if (isUser) return <UserIcon className="w-5 h-5 text-adk-text" />;
        if (isTool) return <ToolIcon className="w-5 h-5 text-white" />;
        return <BotIcon className="w-5 h-5 text-white" />;
    };

    const getBubbleColor = () => {
        if (isUser) return 'bg-adk-accent text-white';
        if (isTool) return 'bg-adk-dark-3 text-adk-text-secondary';
        return 'bg-adk-dark-2 text-adk-text';
    };

    const getIconBgColor = () => {
        if (isUser) return 'bg-adk-dark-3';
        if (isTool) return 'bg-adk-accent-dark';
        return 'bg-adk-accent';
    };

    return (
        <div className={`flex items-start gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && <div className={`flex-shrink-0 w-8 h-8 rounded-full ${getIconBgColor()} flex items-center justify-center`}>{getIcon()}</div>}
            <div className={`max-w-3xl p-4 rounded-lg shadow-md ${getBubbleColor()}`}>
                <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
            {isUser && <div className={`flex-shrink-0 w-8 h-8 rounded-full ${getIconBgColor()} flex items-center justify-center`}>{getIcon()}</div>}
        </div>
    );
};

const LoadingIndicator: React.FC<{ status: LoadingStatus }> = ({ status }) => {
    const Icon = status.type === 'tool_use' ? TransferIcon : SpinnerIcon;
    const iconAnimation = status.type === 'tool_use' ? 'animate-pulse' : 'animate-spin';
    return (
        <div className="flex justify-start gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-adk-accent flex items-center justify-center"><BotIcon className="w-5 h-5 text-white" /></div>
            <div className="max-w-xl p-4 rounded-lg bg-adk-dark-2 text-adk-text flex items-center shadow-md">
                <Icon className={`${iconAnimation} w-5 h-5 mr-3`} /> {status.message}
            </div>
        </div>
    );
};

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ agent }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loadingStatus, setLoadingStatus] = useState<LoadingStatus | null>(null);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    const switchSession = async () => {
        if (agent) {
            setLoadingStatus({ type: 'thinking', message: 'Initializing session...' });
            try {
                const session = await sessionManager.getSession(agent.name);
                setCurrentSession(session);
                setMessages([...session.history]);
            } catch (error) {
                console.error("Failed to get session:", error);
                setMessages([{ role: 'model', content: `Error starting session: ${error instanceof Error ? error.message : 'Unknown error'}` }]);
                setCurrentSession(null);
            } finally {
                setLoadingStatus(null);
            }
        } else {
            setCurrentSession(null);
            setMessages([]);
        }
    };
    switchSession();
  }, [agent]);
  
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, loadingStatus]);

  useEffect(() => {
    // When the agent is done loading, focus the input
    if (loadingStatus === null) {
      inputRef.current?.focus();
    }
  }, [loadingStatus]);

  if (!agent) {
    return (
        <div className="flex items-center justify-center h-full text-adk-text-secondary bg-adk-dark">
            <div className="text-center">
                <BotIcon className="w-16 h-16 mx-auto mb-4 text-adk-dark-3" />
                <h2 className="text-xl font-semibold text-adk-text">Welcome to the ADK Agent Gallery</h2>
                <p>Select a running agent from the sidebar to begin a conversation.</p>
            </div>
        </div>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !selectedFile) || loadingStatus || !currentSession) return;

    let currentInput = input;
    const currentFile = selectedFile;

    if (currentFile && !currentInput.trim()) {
      currentInput = "Here's the file.";
    }

    setInput('');
    setSelectedFile(null);

    if (currentInput === '/error') {
        setMessages(prev => [...prev, { role: 'user', content: currentInput }]);
        setLoadingStatus({ type: 'thinking', message: 'Triggering error...' });
        const request = new Request(`${agent.url}/nonexistent-endpoint`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: '/error' }),
        });
        try {
            await causeError(agent);
        } catch (error) {
            if (currentSession && error instanceof Error) {
                currentSession.recordError(request, error);
            }
            const errorMessageContent = error instanceof Error ? error.message : 'An unknown error occurred.';
            setMessages(prev => [...prev, { role: 'model', content: `Deliberate error triggered: ${errorMessageContent}` }]);
        } finally {
            setLoadingStatus(null);
        }
        return;
    }

    setLoadingStatus({ type: 'thinking', message: 'Thinking...' });
    
    try {
        for await (const event of currentSession.runTurn(currentInput, currentFile)) {
            if (event.type === 'tool_call') {
                const toolName = event.content.name;
                setLoadingStatus({ type: 'tool_use', message: `Using ${toolName} tool...` });
                setMessages([...currentSession.history]);
            } else if (event.type === 'tool_result') {
                setLoadingStatus({ type: 'thinking', message: 'Thinking...' });
                setMessages([...currentSession.history]);
            } else if (event.type === 'final_answer') {
                // The session service now manages the history, so we just sync it.
                setMessages([...currentSession.history]);
            }
        }
    } catch (error) {
        const errorMessageContent = error instanceof Error ? error.message : 'Sorry, there was an error processing your request.';
        setMessages([...currentSession.history, { role: 'model', content: errorMessageContent }]);
        console.error(error);
    } finally {
        setLoadingStatus(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-adk-dark">
      <header className="flex-shrink-0 p-4 border-b border-adk-dark-3">
        <h1 className="text-xl font-bold">{agent.name}</h1>
        <p className="text-sm text-adk-text-secondary">Status: <span className="text-status-running font-semibold">Running</span> at {agent.url}</p>
      </header>
      
      <main ref={chatContainerRef} className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg, index) => <ChatBubble key={index} message={msg} />)}
        {loadingStatus && <LoadingIndicator status={loadingStatus} />}
      </main>

      <footer className="flex-shrink-0 p-4 border-t border-adk-dark-3">
        <form onSubmit={handleSubmit} className="flex items-center bg-adk-dark-2 border border-adk-dark-3 rounded-lg p-2 focus-within:ring-2 focus-within:ring-adk-accent">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 bg-transparent px-4 py-2 text-adk-text focus:outline-none"
            disabled={!!loadingStatus}
          />
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={!!loadingStatus} className="p-2 rounded-md hover:bg-adk-dark-3 text-adk-text-secondary disabled:text-adk-dark-3 disabled:cursor-not-allowed transition-colors">
            <FileUploadIcon className="w-6 h-6" />
          </button>
          <button type="submit" disabled={!!loadingStatus || (!input.trim() && !selectedFile)} className="p-2 rounded-md bg-adk-accent hover:bg-adk-accent-hover text-white disabled:bg-adk-dark-3 disabled:text-adk-text-secondary disabled:cursor-not-allowed transition-colors">
            <SendIcon className="w-6 h-6" />
          </button>
        </form>
        {selectedFile && (
            <div className="text-xs text-adk-text-secondary mt-2">
                Selected file: {selectedFile.name}
            </div>
        )}
      </footer>
    </div>
  );
};