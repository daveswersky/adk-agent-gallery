
export enum AgentStatus {
  RUNNING = 'RUNNING',
  STOPPED = 'STOPPED',
  STARTING = 'STARTING',
  STOPPING = 'STOPPING',
  ERROR = 'ERROR',
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  status: AgentStatus;
  url?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

// WebSocket message types from server
export interface StatusMessage {
    type: 'status';
    agent: string;
    status: 'running' | 'stopped' | 'already_running' | 'not_running';
    url?: string;
    pid?: number;
}

export interface LogMessage {
    type: 'log';
    agent: string;
    line: string;
}

export type ServerMessage = StatusMessage | LogMessage;

// WebSocket message types from client
export interface StartAgentCommand {
    action: 'start';
    agent_name: string;
    port: number;
}

export interface StopAgentCommand {
    action: 'stop';
    agent_name: string;
}

export type ClientCommand = StartAgentCommand | StopAgentCommand;
