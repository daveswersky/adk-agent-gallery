
import React from 'react';
import { Agent, AgentStatus } from '../types';
import { PlayIcon, StopIcon, SpinnerIcon } from './icons';

interface AgentCardProps {
  agent: Agent;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onSelect: (agent: Agent) => void;
}

const StatusBadge: React.FC<{ status: AgentStatus }> = ({ status }) => {
  const baseClasses = "px-2 py-1 text-xs font-semibold rounded-full inline-flex items-center";
  let specificClasses = "";
  // FIX: Explicitly type `text` as string to allow for modification.
  let text: string = status;

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
      text = `${status}...`;
      break;
    case AgentStatus.ERROR:
      specificClasses = "bg-red-800/50 text-red-400";
      break;
  }

  return <span className={`${baseClasses} ${specificClasses}`}>{text}</span>;
};


export const AgentCard: React.FC<AgentCardProps> = ({ agent, onStart, onStop, onSelect }) => {
const { status } = agent;
  const isRunning = status === 'RUNNING';
  const isStopped = status === 'STOPPED';

  const handleCardClick = () => {
    if (isRunning) {
      onSelect(agent);
    }
  };

  return (
    <div 
      className={`bg-adk-dark-2 rounded-lg p-4 flex flex-col justify-between border border-adk-dark-3 transition-all duration-300 ${isRunning ? 'cursor-pointer hover:border-adk-accent hover:shadow-lg' : 'opacity-75'}`}
      onClick={handleCardClick}
    >
      <div>
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-bold text-lg text-adk-text">{agent.name}</h3>
          <StatusBadge status={agent.status} />
        </div>
        <p className="text-sm text-adk-text-secondary mb-4 h-10 overflow-hidden">
          {agent.description}
        </p>
      </div>
      <div className="flex items-center justify-end space-x-2">
        <button
          onClick={(e) => { e.stopPropagation(); onStart(agent.id); }}
          disabled={!isStopped}
          className="px-4 py-2 text-sm font-medium rounded-md bg-adk-accent hover:bg-adk-accent-hover text-white disabled:bg-adk-dark-3 disabled:text-adk-text-secondary disabled:cursor-not-allowed flex items-center"
        >
          {agent.status === AgentStatus.STARTING ? <SpinnerIcon className="animate-spin w-4 h-4 mr-2" /> : <PlayIcon className="w-4 h-4 mr-2" />}
          {agent.status === AgentStatus.STARTING ? 'Starting' : 'Start'}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onStop(agent.id); }}
          disabled={!isRunning}
          className="px-4 py-2 text-sm font-medium rounded-md bg-adk-dark-3 hover:bg-gray-600 text-adk-text disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          {agent.status === AgentStatus.STOPPING ? <SpinnerIcon className="animate-spin w-4 h-4 mr-2" /> : <StopIcon className="w-4 h-4 mr-2" />}
          {agent.status === AgentStatus.STOPPING ? 'Stopping' : 'Stop'}
        </button>
      </div>
    </div>
  );
};