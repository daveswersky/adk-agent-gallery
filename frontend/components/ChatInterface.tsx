import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { Agent, ChatMessage, AgentEvent } from '../types';
import Session, { LoadingStatus } from '../services/sessionService';
import { sessionManager } from '../services/sessionManager';
import { SendIcon, UserIcon, BotIcon, SpinnerIcon, TransferIcon, FileUploadIcon, ToolIcon, BookOpenIcon } from './icons';
import { AgentStatus } from '../types';

import { causeError } from '../services/agentService';
import { API_BASE_URL } from '../config';

interface ChatInterfaceProps {
  agent: Agent | null;
  agentEvents: AgentEvent[];
  clearAgentEvents: () => void;
  readmeContent: string | null;
  isReadmeLoading: boolean;
}

const ChatBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
    const isUser = message.role === 'user';
    const isTool = message.role === 'tool';
    const isModel = message.role === 'model';

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
                {isModel ? <div className="markdown-content"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{message.content}</ReactMarkdown></div> : <p className="whitespace-pre-wrap">{message.content}</p>}
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

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ agent, agentEvents, clearAgentEvents, readmeContent, isReadmeLoading }) => {
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
        // Only initialize a session if the agent is actually running
        if (agent && agent.status === AgentStatus.RUNNING) {
            setLoadingStatus({ type: 'thinking', message: 'Initializing session...' });
            try {
                const session = await sessionManager.getSession(agent.id);
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
            // If no agent is running, or we are in README view, clear session state.
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

  // Effect to process real-time agent events from the WebSocket
  useEffect(() => {
    if (!currentSession) return;

    for (const event of agentEvents) {
      if (event.event === 'before_tool_call') {
        const toolName = event.tool_call.name;
        setLoadingStatus({ type: 'tool_use', message: `Using ${toolName} tool...` });
        const toolArgs = JSON.stringify(event.tool_call.args, null, 2);
        currentSession.history.push({ role: 'tool', content: `Calling tool: ${toolName}\nArguments:\n${toolArgs}` });
        setMessages([...currentSession.history]);
      } else if (event.event === 'after_tool_call') {
        setLoadingStatus({ type: 'thinking', message: 'Thinking...' });
        const toolName = event.tool_call.name;
        const toolResult = JSON.stringify(event.tool_result, null, 2);
        currentSession.history.push({ role: 'tool', content: `Tool ${toolName} returned:\n${toolResult}` });
        setMessages([...currentSession.history]);
      }
    }
    // We've processed the events, clear them so they aren't re-processed
    if (agentEvents.length > 0) {
      clearAgentEvents();
    }
  }, [agentEvents, currentSession, clearAgentEvents]);

  if (!agent) {
    return (
        <div className="flex items-center justify-center h-full text-adk-text-secondary bg-adk-dark">
            <div className="text-center">
                <BotIcon className="w-16 h-16 mx-auto mb-4 text-adk-dark-3" />
                <h2 className="text-xl font-semibold text-adk-text">Welcome to the ADK Agent Gallery</h2>
                <p>Select an agent from the sidebar to view its README or start a conversation.</p>
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

    const userMessage: ChatMessage = { 
        role: 'user', 
        content: currentInput + (currentFile ? `\n[File attached: ${currentFile.name}]` : '') 
    };
    setMessages(prev => [...prev, userMessage]);
    setLoadingStatus({ type: 'thinking', message: 'Thinking...' });
    
    try {
        // Clear any stale events from a previous run
        clearAgentEvents();
        // The runTurn method now returns only the final answer
        await currentSession.runTurn(currentInput, currentFile);
        // The session history has been updated by the runTurn call and the event handler
        setMessages([...currentSession.history]);
    } catch (error) {
        const errorMessageContent = error instanceof Error ? error.message : 'Sorry, there was an error processing your request.';
        setMessages([...currentSession.history, { role: 'model', content: errorMessageContent }]);
        console.error(error);
    } finally {
        setLoadingStatus(null);
    }
  };

  const renderStatus = () => {
    switch (agent.status) {
        case AgentStatus.RUNNING:
            return <><span className="text-status-running font-semibold">Running</span> at {agent.url}</>;
        case AgentStatus.STARTING:
            return <span className="text-status-starting font-semibold">Starting...</span>;
        case AgentStatus.STOPPING:
            return <span className="text-status-stopping font-semibold">Stopping...</span>;
        case AgentStatus.STOPPED:
            return <span className="text-status-stopped font-semibold">Stopped</span>;
        case AgentStatus.ERROR:
            return <span className="text-status-error font-semibold">Error</span>;
        default:
            return <span className="text-adk-text-secondary font-semibold">Unknown</span>;
    }
  };

  // Custom image renderer to resolve relative paths
  const transformImageUri = (src: string) => {
    // If the src is a full URL, use it as is.
    if (src.startsWith('http://') || src.startsWith('https://')) {
      return src;
    }
    // Otherwise, construct the URL to the static file endpoint.
    if (agent) {
      const encodedAgentId = encodeURIComponent(agent.id);
      const encodedSrc = encodeURIComponent(src);
      return `${API_BASE_URL}/agents/${encodedAgentId}/static/${encodedSrc}`;
    }
    return src;
  };

  // If the agent isn't running, show the README view.
  if (agent.status !== AgentStatus.RUNNING) {
    return (
      <div className="h-full flex flex-col bg-adk-dark">
        <header className="flex-shrink-0 p-4 border-b border-adk-dark-3">
          <h1 className="text-xl font-bold">{agent.name}</h1>
          <p className="text-sm text-adk-text-secondary">Status: {renderStatus()}</p>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          {isReadmeLoading ? (
            <div className="flex items-center justify-center h-full text-adk-text-secondary">
              <SpinnerIcon className="w-8 h-8 animate-spin mr-4" />
              <span>Loading README...</span>
            </div>
          ) : (
            <div className="markdown-content">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                urlTransform={transformImageUri}
              >
                {readmeContent || 'No README content available.'}
              </ReactMarkdown>
            </div>
          )}
        </main>
        <footer className="flex-shrink-0 p-4 border-t border-adk-dark-3 text-center text-sm text-adk-text-secondary">
          Start this agent to begin a conversation.
        </footer>
      </div>
    );
  }

  // Otherwise, show the Chat Interface.
  return (
    <div className="h-full flex flex-col bg-adk-dark">
      <header className="flex-shrink-0 p-4 border-b border-adk-dark-3">
        <h1 className="text-xl font-bold">{agent.name}</h1>
        <p className="text-sm text-adk-text-secondary">Status: {renderStatus()}</p>
      </header>
      
      <main ref={chatContainerRef} data-testid="chat-history" className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg, index) => <ChatBubble key={index} message={msg} />)}
        {loadingStatus && <LoadingIndicator status={loadingStatus} />}
      </main>

      <footer className="flex-shrink-0 p-4 border-t border-adk-dark-3">
        <form onSubmit={handleSubmit} className="flex items-center bg-adk-dark-2 border border-adk-dark-3 rounded-lg p-2 focus-within:ring-2 focus-within:ring-adk-accent">
          <input
            ref={inputRef}
            data-testid="chat-input"
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
          <button data-testid="send-button" type="submit" disabled={!!loadingStatus || (!input.trim() && !selectedFile)} className="p-2 rounded-md bg-adk-accent hover:bg-adk-accent-hover text-white disabled:bg-adk-dark-3 disabled:text-adk-text-secondary disabled:cursor-not-allowed transition-colors">
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