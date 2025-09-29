import { useState, useEffect, useRef, useCallback } from 'react';
import { Agent, AgentStatus, ServerMessage } from '../types';

// In a real app, this might come from an API call or a config file
const INITIAL_AGENTS: Agent[] = [
  {
    id: 'greeting_agent',
    name: 'Greeting Agent',
    description: 'A simple agent that says hello.',
    status: AgentStatus.STOPPED,
  },
  {
    id: 'weather_agent',
    name: 'Weather Agent',
    description: 'Provides weather forecasts.',
    status: AgentStatus.STOPPED,
  },
];

// Assign static ports to agents
const AGENT_PORTS: { [key: string]: number } = {
  greeting_agent: 8001,
  weather_agent: 8002,
};

const MANAGEMENT_URL = 'ws://localhost:8000/ws';

export const useManagementSocket = () => {
  const [agents, setAgents] = useState<Agent[]>(INITIAL_AGENTS);
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);

  const appendLog = useCallback((log: string) => {
    // Keep the log to a reasonable size
    setLogs(prev => [...prev.slice(-200), log]);
  }, []);

  useEffect(() => {
    ws.current = new WebSocket(MANAGEMENT_URL);

    ws.current.onopen = () => {
      setIsConnected(true);
      appendLog('--- Connected to management server ---');
    };

    ws.current.onclose = () => {
      setIsConnected(false);
      appendLog('--- Disconnected from management server ---');
      // Optionally, reset agent statuses on disconnect
      setAgents(prev => prev.map(a => ({ ...a, status: AgentStatus.STOPPED, url: undefined })));
    };

    ws.current.onmessage = (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data);

        if (message.type === 'status') {
          const { agent: agentId, status, url } = message;
          setAgents(prev => prev.map(agent => {
            if (agent.id === agentId) {
              let newStatus: AgentStatus;
              switch (status) {
                case 'running':
                case 'already_running':
                  newStatus = AgentStatus.RUNNING;
                  break;
                case 'stopped':
                case 'not_running':
                  newStatus = AgentStatus.STOPPED;
                  break;
                default:
                  newStatus = agent.status; // Should not happen
              }
              appendLog(`--- Status [${agent.name}]: ${status.toUpperCase()} ---`);
              return { ...agent, status: newStatus, url: url || undefined };
            }
            return agent;
          }));
        } else if (message.type === 'log') {
          const { agent, line } = message;
          appendLog(`[${agent}] ${line}`);
        }
      } catch (error) {
        console.error("Error parsing message from server:", event.data);
        appendLog("--- Error parsing server message ---");
      }
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      appendLog('--- WebSocket connection error ---');
      setIsConnected(false);
    };

    // Cleanup on unmount
    return () => {
      ws.current?.close();
    };
  }, [appendLog]);

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
        setAgents(prev => prev.map(a => a.id === agentId ? { ...a, status: AgentStatus.STARTING } : a));
        sendCommand({
          action: 'start',
          agent_name: agentId,
          port: AGENT_PORTS[agentId],
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

  return { agents, logs, isConnected, startAgent, stopAgent };
};
