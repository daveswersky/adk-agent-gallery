import React from 'react';
import { Flipper, Flipped } from 'react-flip-toolkit';
import { Agent, AgentGroup, AgentStatus } from '../types';
import { PlayIcon, StopIcon, SpinnerIcon, ClearIcon, CodeBracketIcon } from './icons';

interface AgentSidebarProps {
  agentGroups: AgentGroup[];
  selectedAgent: Agent | null;
  isConnected: boolean;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onStopAll: () => void;
  onSelectAgent: (agent: Agent) => void;
  onViewCode: (id: string) => void;
}

const StatusBadge: React.FC<{ status: AgentStatus }> = ({ status }) => {
  const baseClasses = "px-2 py-1 text-xs font-semibold rounded-full inline-flex items-center";
  let specificClasses = "";
  let text = status;

  switch (status) {
    case AgentStatus.RUNNING:
      specificClasses = "bg-status-running/20 text-status-running";
      break;
    case AgentStatus.STOPPED:
      specificClasses = "bg-status-stopped/20 text-status-stopped";
      break;
    case AgentStatus.STARTING:
    case AgentStatus.STOPPING:
      specificClasses = "bg-status-starting/20 text-status-starting";
      text = status;
      break;
    case AgentStatus.ERROR:
      specificClasses = "bg-red-800/50 text-red-400";
      break;
  }

  return <span className={`${baseClasses} ${specificClasses}`}>{text}</span>;
};

const AgentListItem: React.FC<{
  agent: Agent;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onSelect: (agent: Agent) => void;
  onViewCode: (id: string) => void;
  isActive: boolean;
}> = ({ agent, onStart, onStop, onSelect, onViewCode, isActive }) => {
  const isRunning = agent.status === AgentStatus.RUNNING;

  return (
    <div
      data-testid={`agent-card-${agent.id}`}
      onClick={() => isRunning && onSelect(agent)}
      className={`p-2 rounded-lg border flex flex-col transition-colors duration-200 ${isActive ? 'bg-adk-accent/20 border-adk-accent' : 'border-adk-dark-3 hover:bg-adk-dark-3'} ${isRunning ? 'cursor-pointer' : ''}`}
    >
      <div className="flex justify-between items-center mb-1">
        <h4 className="font-semibold text-adk-text truncate pr-2 text-base">{agent.name}</h4>
        <div data-testid={`agent-status-${agent.id}`}>
          <StatusBadge status={agent.status} />
        </div>
      </div>
      <p className="text-xs text-adk-text-secondary mb-2 text-ellipsis overflow-hidden">{agent.description}</p>
      <div className="flex items-center justify-end space-x-2 mt-auto">
        <button
          onClick={(e) => { e.stopPropagation(); onViewCode(agent.id); }}
          className="p-2 text-sm font-medium rounded-md bg-adk-dark-3 hover:bg-adk-accent hover:text-white flex items-center transition-colors"
          title="View Code"
        >
          <CodeBracketIcon className="w-5 h-5" />
        </button>
        <button
          data-testid={`start-agent-${agent.id}`}
          onClick={(e) => { e.stopPropagation(); onStart(agent.id); }}
          disabled={agent.status !== AgentStatus.STOPPED}
          className="p-2 text-sm font-medium rounded-md bg-adk-dark-3 hover:bg-adk-accent hover:text-white disabled:bg-adk-dark-3/50 disabled:text-adk-text-secondary disabled:cursor-not-allowed flex items-center transition-colors"
          aria-label={`Start ${agent.name}`}
        >
          {agent.status === AgentStatus.STARTING ? <SpinnerIcon className="animate-spin w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
        </button>
        <button
          data-testid={`stop-agent-${agent.id}`}
          onClick={(e) => { e.stopPropagation(); onStop(agent.id); }}
          disabled={!isRunning}
          className="p-2 text-sm font-medium rounded-md bg-adk-dark-3 hover:bg-status-stopped/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
           aria-label={`Stop ${agent.name}`}
       >
          {agent.status === AgentStatus.STOPPING ? <SpinnerIcon className="animate-spin w-5 h-5" /> : <StopIcon className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
};


export const AgentSidebar: React.FC<AgentSidebarProps> = ({ agentGroups, selectedAgent, isConnected, onStart, onStop, onStopAll, onSelectAgent, onViewCode }) => {
  const [searchTerm, setSearchTerm] = React.useState('');

  const handleStartAgent = React.useCallback((id: string) => {
    onStart(id);
    setSearchTerm('');
  }, [onStart, setSearchTerm]);

  const allAgents = agentGroups.flatMap(group => group.agents);

  const anyAgentRunning = allAgents.some(agent => agent.status === AgentStatus.RUNNING);

  const filteredAndSortedAgents = allAgents
    .filter(agent => agent.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      const statusOrder = {
        [AgentStatus.RUNNING]: 1,
        [AgentStatus.STARTING]: 2,
        [AgentStatus.STOPPING]: 3,
        [AgentStatus.STOPPED]: 4,
        [AgentStatus.ERROR]: 5,
      };
      return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
    });

  const displayedGroups = searchTerm
    ? [{ name: 'Search Results', agents: filteredAndSortedAgents }]
    : agentGroups.map(group => ({
        ...group,
        agents: group.agents.sort((a, b) => {
          const statusOrder = {
            [AgentStatus.RUNNING]: 1,
            [AgentStatus.STARTING]: 2,
            [AgentStatus.STOPPING]: 3,
            [AgentStatus.STOPPED]: 4,
            [AgentStatus.ERROR]: 5,
          };
          return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
        })
      }));

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
        <Flipper flipKey={filteredAndSortedAgents.map(a => a.id).join('')} className="space-y-4">
          {displayedGroups.map(group => (
            <details key={group.name} open className="group">
              <summary className="text-lg font-semibold text-white cursor-pointer list-none -ml-2 p-2 rounded-md hover:bg-adk-dark-3">
                <span className="transform transition-transform duration-200 group-open:rotate-90 inline-block mr-2">&#9656;</span>
                {group.name}
              </summary>
              <div className="space-y-4 mt-2 pl-2 border-l-2 border-adk-dark-3">
                {group.agents.length > 0 ? group.agents.map((agent) => (
                  <Flipped key={agent.id} flipId={agent.id}>
                    <div>
                      <AgentListItem
                        agent={agent}
                        onStart={handleStartAgent}
                        onStop={onStop}
                        onSelect={onSelectAgent}
                        onViewCode={onViewCode}
                        isActive={selectedAgent?.id === agent.id}
                      />
                    </div>
                  </Flipped>
                )) : (
                  !searchTerm && (
                    <div className="text-center py-6 text-adk-text-secondary">
                      <p>No agents in this group.</p>
                    </div>
                  )
                )}
              </div>
            </details>
          ))}
          {agentGroups.length > 0 && filteredAndSortedAgents.length === 0 && searchTerm && (
            <div className="text-center py-12 text-adk-text-secondary">
              <p>No agents found for "{searchTerm}"</p>
            </div>
          )}
          {agentGroups.length === 0 && !searchTerm && (
             <div className="text-center py-12 text-adk-text-secondary">
                <>
                  <SpinnerIcon className="w-8 h-8 mx-auto animate-spin-slow mb-4" />
                  <p>Waiting for agent data...</p>
                </>
            </div>
          )}
        </Flipper>
      </div>
    </aside>
  );
};