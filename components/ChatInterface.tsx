import React, { useState, useRef, useEffect } from 'react';
import type { Agent, ChatMessage } from '../types';
import Session from '../services/sessionService';
import { SendIcon, UserIcon, BotIcon, SpinnerIcon } from './icons';

interface ChatInterfaceProps {
  agent: Agent | null;
}

const ChatBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
    const isUser = message.role === 'user';
    return (
        <div className={`flex items-start gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-adk-accent flex items-center justify-center"><BotIcon className="w-5 h-5 text-white" /></div>}
            <div className={`max-w-3xl p-4 rounded-lg shadow-md ${isUser ? 'bg-adk-accent text-white' : 'bg-adk-dark-2 text-adk-text'}`}>
                <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
            {isUser && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-adk-dark-3 flex items-center justify-center"><UserIcon className="w-5 h-5 text-adk-text" /></div>}
        </div>
    );
};

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ agent }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Clear chat and create new session when agent changes
  useEffect(() => {
    setMessages([]);
    if (agent && agent.url) {
      const newSession = new Session(agent.url, agent.name);
      newSession.create().then(() => {
        setSession(newSession);
      }).catch(error => {
        console.error("Failed to create session:", error);
        // Optionally, display an error message to the user
      });
    } else {
      setSession(null);
    }
  }, [agent]);
  
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !session) return;

    const userMessage: ChatMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
        const responseText = await session.runTurn(input);
        const modelMessage: ChatMessage = { role: 'model', content: responseText };
        setMessages(prev => [...prev, modelMessage]);
    } catch (error) {
        const errorMessageContent = error instanceof Error ? error.message : 'Sorry, there was an error processing your request.';
        const errorMessage: ChatMessage = { role: 'model', content: errorMessageContent };
        setMessages(prev => [...prev, errorMessage]);
        console.error(error);
    } finally {
        setIsLoading(false);
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
        {isLoading && (
            <div className="flex justify-start gap-4">
                 <div className="flex-shrink-0 w-8 h-8 rounded-full bg-adk-accent flex items-center justify-center"><BotIcon className="w-5 h-5 text-white" /></div>
                 <div className="max-w-xl p-4 rounded-lg bg-adk-dark-2 text-adk-text flex items-center shadow-md">
                    <SpinnerIcon className="animate-spin w-5 h-5 mr-3" /> Thinking...
                 </div>
            </div>
        )}
      </main>

      <footer className="flex-shrink-0 p-4 border-t border-adk-dark-3">
        <form onSubmit={handleSubmit} className="flex items-center bg-adk-dark-2 border border-adk-dark-3 rounded-lg p-2 focus-within:ring-2 focus-within:ring-adk-accent">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 bg-transparent px-4 py-2 text-adk-text focus:outline-none"
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading || !input.trim()} className="p-2 rounded-md bg-adk-accent hover:bg-adk-accent-hover text-white disabled:bg-adk-dark-3 disabled:text-adk-text-secondary disabled:cursor-not-allowed transition-colors">
            <SendIcon className="w-6 h-6" />
          </button>
        </form>
      </footer>
    </div>
  );
};