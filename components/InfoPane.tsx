import React, { useState, useMemo } from 'react';
import { Agent, AgentStatus } from '../types';
import { LogViewer } from './LogViewer';
import { SpinnerIcon } from './icons';
import { sessionManager } from '../services/sessionManager';
import { SessionItem } from './SessionItem';

interface InfoPaneProps {
  logs: string[];
  agents: Agent[];
  selectedAgent: Agent | null;
}

type ActiveTab = 'Servers' | 'Events' | 'Sessions';

const StatusIndicator: React.FC<{ status: AgentStatus }> = ({ status }) => {
  const title = status.charAt(0) + status.slice(1).toLowerCase();
  switch (status) {
    case AgentStatus.RUNNING:
      return <div className="w-2.5 h-2.5 rounded-full bg-status-running" title={title}></div>;
    case AgentStatus.STARTING:
    case AgentStatus.STOPPING:
      return <SpinnerIcon className="w-3 h-3 text-status-starting animate-spin" title={title} />;
    case AgentStatus.ERROR:
       return <div className="w-2.5 h-2.5 rounded-full bg-red-500" title={title}></div>;
    default:
      return <div className="w-2.5 h-2.5 rounded-full bg-status-stopped" title={title}></div>;
  }
};

export const InfoPane: React.FC<InfoPaneProps> = ({ logs, agents, selectedAgent }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('Events');

  const filteredLogs = useMemo(() => {
    if (!selectedAgent) {
      return logs.filter(log => !log.startsWith('['));
    }
    const agentPrefix = `[${selectedAgent.id}]`;
    return logs.filter(log => !log.startsWith('[') || log.startsWith(agentPrefix));
  }, [logs, selectedAgent]);

  const getTabClass = (tabName: ActiveTab) => {
    return `px-4 py-2 text-sm font-medium rounded-t-md cursor-pointer transition-colors ${
      activeTab === tabName 
      ? 'bg-adk-dark text-adk-accent border-b-2 border-adk-accent' 
      : 'text-adk-text-secondary hover:bg-adk-dark-3'
    }`;
  };

  const runningServers = agents.filter(
    agent => agent.status !== AgentStatus.STOPPED
  );

  const activeSessions = useMemo(() => {
    const allSessions = sessionManager.getSessionDetails();
    if (selectedAgent) {
      return allSessions.filter(s => s.agentId === selectedAgent.id);
    }
    return allSessions;
  }, [selectedAgent, logs]); // Re-calculate when logs change


  const renderContent = () => {
    switch (activeTab) {
      case 'Servers':
        return (
          <div className="p-4 font-mono text-sm text-adk-text-secondary space-y-2 h-full overflow-y-auto">
            {runningServers.length > 0 ? (
              runningServers.map(agent => (
                <div key={agent.id} className="grid grid-cols-[auto,1fr,auto,1fr] items-center gap-x-4 p-2 rounded bg-adk-dark-2">
                   <StatusIndicator status={agent.status} />
                   <span className="font-semibold text-adk-text truncate" title={agent.name}>{agent.name}</span>
                   <span className="text-xs">{agent.status}</span>
                   <span className="text-xs text-adk-accent truncate" title={agent.url}>{agent.url || 'Assigning URL...'}</span>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center h-full">
                No servers are currently running.
              </div>
            )}
          </div>
        );
      case 'Events':
        return (
          <div data-testid="info-pane-logs" className="h-full">
            <LogViewer logs={filteredLogs} />
          </div>
        );
      case 'Sessions':
        return (
          <div className="p-4 font-mono text-sm text-adk-text-secondary space-y-2 h-full overflow-y-auto">
            {activeSessions.length > 0 ? (
              activeSessions.map(session => (
                <SessionItem key={session.sessionId} session={session} />
              ))
            ) : (
              <div className="flex items-center justify-center h-full">
                {selectedAgent ? 'No active session for this agent.' : 'No active sessions.'}
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col bg-adk-dark-2">
      <nav className="flex-shrink-0 px-2 pt-2 border-b border-adk-dark-3">
        <ul className="flex">
          <li>
            <button onClick={() => setActiveTab('Servers')} className={getTabClass('Servers')}>
              Servers
            </button>
          </li>
          <li>
            <button onClick={() => setActiveTab('Events')} className={getTabClass('Events')}>
              Events
            </button>
          </li>
          <li>
            <button onClick={() => setActiveTab('Sessions')} className={getTabClass('Sessions')}>
              Sessions
            </button>
          </li>
        </ul>
      </nav>
      <div className="flex-1 overflow-hidden bg-adk-dark">
        {renderContent()}
      </div>
    </div>
  );
};