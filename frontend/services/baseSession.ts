import { v4 as uuidv4 } from 'uuid';
import { ChatMessage, RequestRecord, HttpError } from '../types';

export abstract class BaseSession {
    public sessionId: string;
    protected agentId: string;
    protected agentName: string;
    protected agentType: 'adk' | 'a2a';
    protected agentUrl?: string;
    protected userId: string;
    public history: ChatMessage[] = [];
    public requestHistory: RequestRecord[] = [];

    constructor(agentId: string, agentName: string, agentType: 'adk' | 'a2a', agentUrl?: string) {
        this.sessionId = uuidv4();
        this.agentId = agentId;
        this.agentName = agentName;
        this.agentType = agentType;
        this.agentUrl = agentUrl;
        this.userId = "forusone";
    }

    protected async recordRequest(request: Request, response: Response, responseBody: string): Promise<void> {
        // Clone the request to read its body, as the body can only be read once.
        const requestClone = request.clone();
        const requestBody = request.method === 'POST' ? await requestClone.text() : '';
        const requestHeaders: Record<string, string> = {};
        request.headers.forEach((value, key) => { requestHeaders[key] = value; });

        this.requestHistory.push({
            timestamp: new Date().toISOString(),
            request: {
                method: request.method,
                url: request.url,
                headers: requestHeaders,
                body: requestBody,
            },
            response: {
                status: response.status,
                statusText: response.statusText,
                body: responseBody,
            },
        });
    }

    public async recordError(request: Request, error: Error): Promise<void> {
        const requestClone = request.clone();
        const requestBody = request.method === 'POST' ? await requestClone.text() : '';
        const requestHeaders: Record<string, string> = {};
        request.headers.forEach((value, key) => { requestHeaders[key] = value; });
        const status = error instanceof HttpError ? error.status : 0;

        this.requestHistory.push({
            timestamp: new Date().toISOString(),
            request: {
                method: request.method,
                url: request.url,
                headers: requestHeaders,
                body: requestBody,
            },
            response: {
                status: status,
                statusText: 'Error',
                body: error.message,
            },
        });
    }

    abstract runTurn(prompt: string, file?: File | null): Promise<string>;
}
