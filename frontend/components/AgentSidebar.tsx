import React from 'react';
import { Agent, AgentStatus } from '../types';
import { PlayIcon, StopIcon, SpinnerIcon, ClearIcon } from './icons';
import TreeView from './TreeView';

interface AgentSidebarProps {
  agents: Agent[];
  selectedAgent: Agent | null;
  isConnected: boolean;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onStopAll: () => void;
  onSelectAgent: (agent: Agent) => void;
  onViewCode: (agent: Agent) => void;
}

export const AgentSidebar: React.FC<AgentSidebarProps> = ({ agents, selectedAgent, isConnected, onStart, onStop, onStopAll, onSelectAgent, onViewCode }) => {
  const [searchTerm, setSearchTerm] = React.useState('');

  const handleStartAgent = React.useCallback((id: string) => {
    onStart(id);
    setSearchTerm('');
  }, [onStart, setSearchTerm]);

  const sortedAgents = [...agents].sort((a, b) => {
    const statusOrder = {
      [AgentStatus.RUNNING]: 1,
      [AgentStatus.STARTING]: 2,
      [AgentStatus.STOPPING]: 3,
      [AgentStatus.STOPPED]: 4,
      [AgentStatus.ERROR]: 5,
    };
    return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
  });

  const filteredAgents = sortedAgents.filter(agent =>
    agent.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const anyAgentRunning = agents.some(agent => agent.status === AgentStatus.RUNNING);

  return (
    <aside className="w-full h-full bg-adk-dark-2 flex flex-col border-r border-adk-dark-3">
      <header className="p-4 border-b border-adk-dark-3 flex-shrink-0">
        <h1 className="text-2xl font-bold text-white">ADK Agent Gallery</h1>
        <div className="flex items-center space-x-2 mt-1">
            <div className={`w-3 h-3 rounded-full animate-pulse ${isConnected ? 'bg-status-running' : 'bg-status-stopped'}`}></div>
            <p className="text-sm text-adk-text-secondary">{isConnected ? 'Connected' : 'Disconnected'}</p>
        </div>
        <div className="relative mt-4">
          <input
            type="text"
            placeholder="Search agents..."
            className="w-full p-2 bg-adk-dark border border-adk-dark-3 rounded-md text-white placeholder-adk-text-secondary focus:outline-none focus:ring-2 focus:ring-adk-accent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-adk-text-secondary hover:text-white"
            >
              <ClearIcon className="w-5 h-5" />
            </button>
          )}
        </div>
        <button
          onClick={onStopAll}
          disabled={!anyAgentRunning}
          className="w-full mt-2 p-2 text-sm font-medium rounded-md bg-status-stopped/20 text-status-stopped hover:bg-status-stopped/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
          aria-label="Stop all running agents"
        >
          <StopIcon className="w-5 h-5 mr-2" />
          Stop All
        </button>
      </header>
      <div className="flex-1 overflow-y-auto p-4">
        {filteredAgents.length > 0 ? (
          <TreeView 
            agents={filteredAgents} 
            selectedAgent={selectedAgent}
            onStart={handleStartAgent}
            onStop={onStop}
            onSelectAgent={onSelectAgent} 
            onViewCode={onViewCode}
          />
        ) : (
          <div className="text-center py-12 text-adk-text-secondary">
            {agents.length > 0 && searchTerm ? (
              <p>No agents found for "{searchTerm}"</p>
            ) : (
              <>
                <SpinnerIcon className="w-8 h-8 mx-auto animate-spin-slow mb-4" />
                <p>Waiting for agent data...</p>
              </>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};