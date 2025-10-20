import React, { useState, useEffect, useCallback } from 'react';
import type { Agent, AgentCodeComplex } from './types';
import { AgentStatus } from './types';
import { useManagementSocket } from './hooks/useManagementSocket';
import { AgentSidebar } from './components/AgentSidebar';
import { ChatInterface } from './components/ChatInterface';
import { InfoPane } from './components/InfoPane';
import { getAgentCodeWithSubagents, getAgentReadme } from './services/agentService';
import CodeViewerModal from './components/CodeViewerModal';
import { HttpError } from './types';

// Constants for resizer constraints
const MIN_SIDEBAR_WIDTH = 280; // px
const MAX_SIDEBAR_WIDTH = 600; // px
const MIN_INFO_PANE_HEIGHT = 120; // px

const App: React.FC = () => {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [agentCode, setAgentCode] = useState<AgentCodeComplex | null>(null);
  const [isCodeViewerOpen, setIsCodeViewerOpen] = useState(false);
  const [readmeContent, setReadmeContent] = useState<string | null>(null);
  const [isReadmeLoading, setIsReadmeLoading] = useState<boolean>(false);

  const handleAgentStarted = useCallback((agent: Agent) => {
    // If the user had a non-running agent selected to view its README,
    // and then started it, we should switch to the active chat view.
    if (selectedAgent?.id === agent.id) {
      setReadmeContent(null);
    }
    setSelectedAgent(agent);
  }, [selectedAgent]);

  const { agents, agentGroups, logs, isConnected, agentEvents, clearAgentEvents, startAgent, stopAgent, stopAllAgents } = useManagementSocket({ onAgentStarted: handleAgentStarted });

  // State for resizable panes
  const [sidebarWidth, setSidebarWidth] = useState(384); // Corresponds to w-96
  const [infoPaneHeight, setInfoPaneHeight] = useState(320); // Corresponds to h-80
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingInfoPane, setIsResizingInfoPane] = useState(false);

  // Effect to automatically deselect an agent if its status changes from RUNNING
  // or if the selected agent is stopped.
  useEffect(() => {
    if (selectedAgent) {
      const currentAgentState = agents.find(a => a.id === selectedAgent.id);
      // If the agent is no longer in the list or was running and now isn't
      if (!currentAgentState || (selectedAgent.status === AgentStatus.RUNNING && currentAgentState.status !== AgentStatus.RUNNING)) {
        setSelectedAgent(null);
        setReadmeContent(null);
      } else if (currentAgentState.status === AgentStatus.RUNNING) {
        // If the agent is running, ensure we have the latest info (like URL)
        // and clear any README content.
        setSelectedAgent(currentAgentState);
        setReadmeContent(null);
      } else {
        // If the agent is not running, just update its state (e.g., from STOPPED to STARTING)
        setSelectedAgent(currentAgentState);
      }
    }
  }, [agents, selectedAgent]);


  const handleSelectAgent = async (agent: Agent) => {
    // Always set the selected agent
    setSelectedAgent(agent);

    // If the agent is not running, try to fetch its README
    if (agent.status !== AgentStatus.RUNNING) {
      setIsReadmeLoading(true);
      setReadmeContent(null);
      try {
        const content = await getAgentReadme(agent.id);
        setReadmeContent(content);
      } catch (error) {
        if (error instanceof HttpError && error.status === 404) {
          setReadmeContent("No `README.md` found for this agent.");
        } else {
          setReadmeContent("An error occurred while fetching the README.");
          console.error(error);
        }
      } finally {
        setIsReadmeLoading(false);
      }
    } else {
      // If the agent is running, clear any existing README content
      setReadmeContent(null);
    }
  };


  const handleViewCode = async (agentId: string) => {
    try {
      const code = await getAgentCodeWithSubagents(agentId);
      setAgentCode(code);
      setIsCodeViewerOpen(true);
    } catch (error) {
      console.error("Failed to fetch agent code:", error);
      // Optionally, show an error to the user
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

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const isAgentRunning = agents.some(agent => agent.status === AgentStatus.RUNNING);
      if (isAgentRunning) {
        // Standard way to trigger the browser's native "are you sure?" prompt
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [agents]);

    return (

      <div className="flex h-screen bg-adk-dark text-adk-text font-sans antialiased overflow-hidden">

        <div style={{ width: `${sidebarWidth}px` }} className="h-full flex-shrink-0">

          <AgentSidebar

            agentGroups={agentGroups}

            selectedAgent={selectedAgent}

            isConnected={isConnected}

            onStart={startAgent}

            onStop={stopAgent}

            onStopAll={stopAllAgents}

            onSelectAgent={handleSelectAgent}

            onViewCode={handleViewCode}

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
            readmeContent={readmeContent}
            isReadmeLoading={isReadmeLoading}
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
      {isCodeViewerOpen && (
        <CodeViewerModal
          agentCode={agentCode}
          onClose={() => setIsCodeViewerOpen(false)}
        />
      )}
    </div>
  );
};

export default App;