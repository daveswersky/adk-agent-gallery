
export enum AgentStatus {
  RUNNING = 'RUNNING',
  STOPPED = 'STOPPED',
  STARTING = 'STARTING',
  STOPPING = 'STOPPING',
  ERROR = 'ERROR',
}

export class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  status: AgentStatus;
  type: 'adk' | 'a2a';
  url?: string;
}

export interface AgentGroup {
  name: string;
  agents: Agent[];
}

export interface AgentCodeFile {
  filename: string;
  content: string;
}

export interface AgentCode {
  name: string;
  code: string;
}

export interface AgentCodeComplex {
  main_agent: AgentCode;
  sub_agents: AgentCode[];
}


export interface ChatMessage {
  role: 'user' | 'model' | 'tool';
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

export interface ConfigMessage {
  type: 'config';
  data: { name: string; path: string }[];
}

export interface AgentEvent {
  type: 'agent_event';
  agent: string;
  data: {
    event: string;
    data: any;
  };
}

export type ServerMessage = StatusMessage | LogMessage | ConfigMessage | AgentEvent;


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

export interface RequestRecord {
  timestamp: string;
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: string;
  };
  response: {
    status: number;
    statusText: string;
    body: string;
  };
}
