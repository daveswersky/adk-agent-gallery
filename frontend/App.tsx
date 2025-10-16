import React, { useState, useEffect, useCallback } from 'react';
import type { Agent } from './types';
import { AgentStatus } from './types';
import { useManagementSocket } from './hooks/useManagementSocket';
import { AgentSidebar } from './components/AgentSidebar';
import { ChatInterface } from './components/ChatInterface';
import { InfoPane } from './components/InfoPane';

// Constants for resizer constraints
const MIN_SIDEBAR_WIDTH = 280; // px
const MAX_SIDEBAR_WIDTH = 600; // px
const MIN_INFO_PANE_HEIGHT = 120; // px

const App: React.FC = () => {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const handleAgentStarted = useCallback((agent: Agent) => {
    setSelectedAgent(agent);
  }, []);

  const { agents, logs, isConnected, agentEvents, clearAgentEvents, startAgent, stopAgent, stopAllAgents } = useManagementSocket({ onAgentStarted: handleAgentStarted });

  // State for resizable panes
  const [sidebarWidth, setSidebarWidth] = useState(384); // Corresponds to w-96
  const [infoPaneHeight, setInfoPaneHeight] = useState(320); // Corresponds to h-80
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingInfoPane, setIsResizingInfoPane] = useState(false);

  // Effect to automatically deselect an agent if its status is no longer 'RUNNING'
  useEffect(() => {
    if (selectedAgent) {
      const currentAgentState = agents.find(a => a.id === selectedAgent.id);
      if (!currentAgentState || currentAgentState.status !== AgentStatus.RUNNING) {
        setSelectedAgent(null);
      } else {
        // Update selected agent with latest info (like URL)
        setSelectedAgent(currentAgentState);
      }
    }
  }, [agents, selectedAgent]);


  const handleSelectAgent = (agent: Agent) => {
    if (agent.status === AgentStatus.RUNNING) {
      setSelectedAgent(agent);
    }
  };
  
  // Mouse down handlers to initiate resizing
  const handleSidebarMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);
  
  const handleInfoPaneMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingInfoPane(true);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, []);
  
  // Effect to handle resizing logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingSidebar) {
        const newWidth = e.clientX;
        setSidebarWidth(Math.max(MIN_SIDEBAR_WIDTH, Math.min(newWidth, MAX_SIDEBAR_WIDTH)));
      }
      if (isResizingInfoPane) {
        const newHeight = window.innerHeight - e.clientY;
        const maxInfoPaneHeight = window.innerHeight * 0.7; // Can't take more than 70% of the screen
        setInfoPaneHeight(Math.max(MIN_INFO_PANE_HEIGHT, Math.min(newHeight, maxInfoPaneHeight)));
      }
    };
    
    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      setIsResizingInfoPane(false);
      document.body.style.cursor = 'auto';
      document.body.style.userSelect = 'auto';
    };
    
    if (isResizingSidebar || isResizingInfoPane) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSidebar, isResizingInfoPane]);

  return (
    <div className="flex h-screen bg-adk-dark text-adk-text font-sans antialiased overflow-hidden">
      <div style={{ width: `${sidebarWidth}px` }} className="h-full flex-shrink-0">
        <AgentSidebar
          agents={agents}
          selectedAgent={selectedAgent}
          isConnected={isConnected}
          onStart={startAgent}
          onStop={stopAgent}
          onStopAll={stopAllAgents}
          onSelectAgent={handleSelectAgent}
        />
      </div>

      <div
        onMouseDown={handleSidebarMouseDown}
        className="w-1.5 flex-shrink-0 cursor-col-resize bg-adk-dark-3 hover:bg-adk-accent transition-colors"
        aria-label="Resize sidebar"
        role="separator"
        aria-orientation="vertical"
      />
      
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 min-h-0">
          <ChatInterface
            agent={selectedAgent}
            agentEvents={agentEvents[selectedAgent?.id || ''] || []}
            clearAgentEvents={() => clearAgentEvents(selectedAgent?.id || '')}
          />
        </div>

        <div
          onMouseDown={handleInfoPaneMouseDown}
          className="h-1.5 flex-shrink-0 cursor-row-resize bg-adk-dark-3 hover:bg-adk-accent transition-colors"
          aria-label="Resize information pane"
          role="separator"
          aria-orientation="horizontal"
        />

        <div style={{ height: `${infoPaneHeight}px` }} className="flex-shrink-0">
          <InfoPane logs={logs} agents={agents} selectedAgent={selectedAgent} />
        </div>
      </main>
    </div>
  );
};

export default App;