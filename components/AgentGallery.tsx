
import React from 'react';
import { Agent } from '../types';
import { AgentCard } from './AgentCard';
import { LogViewer } from './LogViewer';

interface AgentGalleryProps {
  agents: Agent[];
  logs: string[];
  isConnected: boolean;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onSelectAgent: (agent: Agent) => void;
}

export const AgentGallery: React.FC<AgentGalleryProps> = ({ agents, logs, isConnected, onStart, onStop, onSelectAgent }) => {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">ADK Agent Gallery</h1>
        <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-status-running' : 'bg-status-stopped'}`}></div>
            <p className="text-adk-text-secondary">{isConnected ? 'Connected to Management Server' : 'Disconnected - Attempting to reconnect...'}</p>
        </div>
      </header>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-adk-text mb-4">Agents</h2>
        {agents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent) => (
                <AgentCard
                key={agent.id}
                agent={agent}
                onStart={onStart}
                onStop={onStop}
                onSelect={onSelectAgent}
                />
            ))}
            </div>
        ) : (
             <div className="text-center py-12 bg-adk-dark-2 rounded-lg border border-adk-dark-3">
                <p className="text-adk-text-secondary">Waiting for agent data from management server...</p>
            </div>
        )}
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-adk-text mb-4">Live Logs</h2>
        <LogViewer logs={logs} />
      </section>
    </div>
  );
};
