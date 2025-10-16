import React from 'react';
import { Agent, AgentStatus } from '../types';
import { PlayIcon, StopIcon, SpinnerIcon } from './icons';

export const StatusBadge: React.FC<{ status: AgentStatus }> = ({ status }) => {
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

export const AgentListItem: React.FC<{
  agent: Agent;
  displayName?: string;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onSelect: (agent: Agent) => void;
  isActive: boolean;
}> = ({ agent, displayName, onStart, onStop, onSelect, isActive }) => {
  const isRunning = agent.status === AgentStatus.RUNNING;

  return (
    <div
      data-testid={`agent-card-${agent.id}`}
      onClick={() => isRunning && onSelect(agent)}
      className={`p-2 rounded-lg border flex flex-col transition-colors duration-200 ${isActive ? 'bg-adk-accent/20 border-adk-accent' : 'border-adk-dark-3 hover:bg-adk-dark-3'} ${isRunning ? 'cursor-pointer' : ''}`}
    >
      <div className="flex justify-between items-center mb-1">
        <h4 className="font-semibold text-adk-text truncate pr-2 text-base">{displayName || agent.name}</h4>
        <div data-testid={`agent-status-${agent.id}`}>
          <StatusBadge status={agent.status} />
        </div>
      </div>
      <p className="text-xs text-adk-text-secondary mb-2 text-ellipsis overflow-hidden">{agent.description}</p>
      <div className="flex items-center justify-end space-x-2 mt-auto">
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
