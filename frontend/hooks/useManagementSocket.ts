import { useState, useEffect, useRef, useCallback } from 'react';
import { Agent, AgentStatus, ServerMessage, AgentEvent, AgentGroup } from '../types';

const MANAGEMENT_URL = 'ws://localhost:8000/ws';
const AGENTS_URL = 'http://localhost:8000/agents';

export const useManagementSocket = ({ onAgentStarted }: { onAgentStarted: (agent: Agent) => void; }) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentRoots, setAgentRoots] = useState<{name: string, path: string}[]>([]);
  const [agentGroups, setAgentGroups] = useState<AgentGroup[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [agentEvents, setAgentEvents] = useState<Record<string, AgentEvent[]>>({});
  const ws = useRef<WebSocket | null>(null);
  const onAgentStartedRef = useRef(onAgentStarted);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
  const isInitialConnection = useRef(true);

  useEffect(() => {
    onAgentStartedRef.current = onAgentStarted;
  }, [onAgentStarted]);

  const appendLog = useCallback((log: string) => {
    setLogs(prev => [...prev.slice(-200), log]);
  }, []);

  const clearAgentEvents = useCallback((agentId: string) => {
    setAgentEvents(prev => ({ ...prev, [agentId]: [] }));
  }, []);

  useEffect(() => {
    if (agentRoots.length > 0 && agents.length > 0) {
      const runningAgents = agents.filter(agent => 
        agent.status === AgentStatus.RUNNING || 
        agent.status === AgentStatus.STARTING || 
        agent.status === AgentStatus.STOPPING
      );

      const stoppedAgents = agents.filter(agent => 
        agent.status === AgentStatus.STOPPED || 
        agent.status === AgentStatus.ERROR
      );

      const runningGroup: AgentGroup = {
        name: 'Running Agents',
        agents: runningAgents,
      };

      const otherGroups: AgentGroup[] = agentRoots.map(root => ({
        name: root.name,
        agents: stoppedAgents.filter(agent => agent.id.startsWith(root.path))
      }));

      const newGroups = [];
      if (runningGroup.agents.length > 0) {
        newGroups.push(runningGroup);
      }
      newGroups.push(...otherGroups);
      
      setAgentGroups(newGroups);
    } else {
      setAgentGroups([]);
    }
  }, [agents, agentRoots]);

  useEffect(() => {
    const connect = async () => {
      // Clear any existing reconnect timer
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }

      // Attempt to fetch agents. If this fails, the server is likely down.
      try {
        const response = await fetch(AGENTS_URL);
        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }
        const data = await response.json();
        const agentsWithStatus = data.map((agent: Omit<Agent, 'status'>) => ({
          ...agent,
          status: AgentStatus.STOPPED,
        }));
        setAgents(agentsWithStatus);
      } catch (error) {
        console.error("Failed to fetch agents, retrying in 3s:", error);
        appendLog('--- Management server offline, trying to connect... ---');
        setIsConnected(false);
        reconnectTimer.current = setTimeout(connect, 3000);
        return;
      }

      // If fetching agents is successful, connect to WebSocket
      ws.current = new WebSocket(MANAGEMENT_URL);

      ws.current.onopen = () => {
        setIsConnected(true);
        if (!isInitialConnection.current) {
          appendLog('--- Reconnected to management server ---');
        }
        isInitialConnection.current = false;
      };

      ws.current.onclose = () => {
        setIsConnected(false);
        appendLog('--- Disconnected. Attempting to reconnect... ---');
        setAgents(prev => prev.map(a => ({ ...a, status: AgentStatus.STOPPED, url: undefined })));
        // Don't use a timer here, as the fetch logic handles retries.
        // Instead, we'll trigger a reconnect directly.
        if (!reconnectTimer.current) {
            reconnectTimer.current = setTimeout(connect, 3000);
        }
      };

      ws.current.onmessage = (event) => {
        try {
          const message: ServerMessage = JSON.parse(event.data);
          if (message.type === 'config') {
            setAgentRoots(message.data);
          } else if (message.type === 'status') {
            const { agent: agentId, status, url } = message;
            setAgents(prevAgents => {
              let startedAgent: Agent | null = null;
              const newAgents = prevAgents.map(agent => {
                if (agent.id === agentId) {
                  let newStatus: AgentStatus;
                  switch (status) {
                    case 'running':
                      newStatus = AgentStatus.RUNNING;
                      // The agent object is updated here, so we capture it.
                      startedAgent = { ...agent, status: newStatus, url: url || undefined };
                      break;
                    case 'already_running':
                      newStatus = AgentStatus.RUNNING;
                      break;
                    case 'stopped':
                    case 'not_running':
                      newStatus = AgentStatus.STOPPED;
                      break;
                    default:
                      newStatus = agent.status;
                  }
                  appendLog(`--- Status [${agent.name}]: ${status.toUpperCase()} ---`);
                  return { ...agent, status: newStatus, url: url || undefined };
                }
                return agent;
              });
              // After the state update, if an agent was started, call the callback.
              if (startedAgent) {
                onAgentStartedRef.current(startedAgent);
              }
              return newAgents;
            });
          } else if (message.type === 'log') {
            const { agent, line } = message;
            appendLog(`[${agent}] ${line}`);
          } else if (message.type === 'agent_event') {
            const { agent: agentId, data } = message;
            setAgentEvents(prev => ({
              ...prev,
              [agentId]: [...(prev[agentId] || []), data],
            }));
          }
        } catch (error) {
          console.error("Error parsing message from server:", event.data);
          appendLog("--- Error parsing server message ---");
        }
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        appendLog('--- WebSocket connection error ---');
        ws.current?.close(); // This will trigger the onclose handler for reconnection
      };
    };

    connect();

    // Cleanup on unmount
    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      ws.current?.close();
    };
  }, []);

  const sendCommand = (command: object) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(command));
    } else {
      console.error('WebSocket is not connected.');
      appendLog('--- Cannot send command: WebSocket not connected ---');
    }
  };

  const startAgent = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (agent && agent.status === AgentStatus.STOPPED) {
        const agentIndex = agents.findIndex(a => a.id === agentId);
        setAgents(prev => prev.map(a => a.id === agentId ? { ...a, status: AgentStatus.STARTING } : a));
        
        const port = 8001 + agentIndex;

        sendCommand({
          action: 'start',
          agent_name: agent.id,
          port: port,
        });
    }
  };

  const stopAgent = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (agent && agent.status === AgentStatus.RUNNING) {
        setAgents(prev => prev.map(a => a.id === agentId ? { ...a, status: AgentStatus.STOPPING } : a));
        sendCommand({
          action: 'stop',
          agent_name: agentId,
        });
    }
  };

  const stopAllAgents = () => {
    sendCommand({ action: 'stop_all' });
  };

  return { agents, agentGroups, logs, isConnected, agentEvents, clearAgentEvents, startAgent, stopAgent, stopAllAgents };
};