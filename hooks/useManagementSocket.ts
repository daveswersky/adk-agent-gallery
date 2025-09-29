import { useState, useEffect, useRef, useCallback } from 'react';
import { Agent, AgentStatus, ServerMessage } from '../types';

const MANAGEMENT_URL = 'ws://localhost:8000/ws';
const AGENTS_URL = 'http://localhost:8000/agents';

export const useManagementSocket = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);

  const appendLog = useCallback((log: string) => {
    setLogs(prev => [...prev.slice(-200), log]);
  }, []);

  useEffect(() => {
    const connect = async () => {
      // 1. Fetch agents first
      try {
        const response = await fetch(AGENTS_URL);
        const data = await response.json();
        const agentsWithStatus = data.map((agent: Omit<Agent, 'status'>) => ({
          ...agent,
          status: AgentStatus.STOPPED,
        }));
        setAgents(agentsWithStatus);
      } catch (error) {
        console.error("Failed to fetch agents:", error);
        appendLog('--- Error fetching agent list ---');
        return; // Don't try to connect if fetching failed
      }

      // 2. Now, connect to WebSocket
      ws.current = new WebSocket(MANAGEMENT_URL);

      ws.current.onopen = () => {
        setIsConnected(true);
        appendLog('--- Connected to management server ---');
      };

      ws.current.onclose = () => {
        setIsConnected(false);
        appendLog('--- Disconnected from management server ---');
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
                    newStatus = agent.status;
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
    };

    connect();

    // Cleanup on unmount
    return () => {
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
    const agentIndex = agents.findIndex(a => a.id === agentId);
    if (agentIndex !== -1 && agents[agentIndex].status === AgentStatus.STOPPED) {
        const agent = agents[agentIndex];
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

  return { agents, logs, isConnected, startAgent, stopAgent };
};