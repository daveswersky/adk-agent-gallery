
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

export class UploadHttpError extends HttpError {
    request: Request;
    constructor(message: string, status: number, request: Request) {
        super(message, status);
        this.name = 'UploadHttpError';
        this.request = request;
    }
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
