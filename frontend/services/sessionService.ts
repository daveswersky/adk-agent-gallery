import { v4 as uuidv4 } from 'uuid';
import { ChatMessage, RequestRecord, HttpError, Agent } from '../types';
import { API_BASE_URL } from '../config';

// This type is now only used by the UI component
export type LoadingStatus = {
    type: 'thinking' | 'tool_use';
    message: string;
};

// A type for the events we yield from the stream
export type AgentEvent = {
    type: 'tool_call' | 'tool_result' | 'final_answer' | 'error';
    content: any;
    name?: string;
};

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            // Remove the data URL prefix (e.g., "data:image/png;base64,")
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = (error) => reject(error);
    });
};

class Session {
    public sessionId: string;
    private agentId: string;
    private agentName: string;
    private agentType: 'adk' | 'a2a';
    private agentUrl?: string;
    private userId: string;
    public history: ChatMessage[] = [];
    public requestHistory: RequestRecord[] = [];

    constructor(agentId: string, agentName: string, agentType: 'adk' | 'a2a', agentUrl?: string) {
        this.sessionId = uuidv4();
        this.agentId = agentId;
        this.agentName = agentName;
        this.agentType = agentType;
        this.agentUrl = agentUrl;
        this.userId = "forusone";

        if (this.agentType === 'a2a') {
            this.createA2ASession();
        }
    }

    private async createA2ASession(): Promise<void> {
        const url = `${this.agentUrl}/apps/${this.agentName}/users/${this.userId}/sessions/${this.sessionId}`;
        const options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        };
        const request = new Request(url, options);
        try {
            const response = await fetch(request);
            if (!response.ok) {
                const errorText = await response.text();
                console.error("Failed to create A2A session:", errorText);
                throw new HttpError(`Failed to create session: ${response.statusText}`, response.status);
            }
        } catch (error) {
            console.error("Error creating A2A session:", error);
        }
    }

    private async recordRequest(request: Request, response: Response, responseBody: string): Promise<void> {
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

    async runTurn(prompt: string, file: File | null = null): Promise<string> {
        const url = this.agentType === 'a2a' ? `${this.agentUrl}/run` : `${API_BASE_URL}/run_turn`;
        if (!url) {
            throw new Error("Agent URL is not available.");
        }
        
        let historyPrompt = prompt;
        if (file) {
            // For simplicity, we're not handling file uploads in this simplified model.
            // The file handling logic would need to be adapted if required.
            historyPrompt += `\n[File attached: ${file.name}]`;
        }

        const body = this.agentType === 'a2a'
            ? {
                appName: this.agentName,
                userId: this.userId,
                sessionId: this.sessionId,
                newMessage: { parts: [{ text: prompt }] }
              }
            : { agent_name: this.agentId, prompt: prompt };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes

        const options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal,
        };

        const request = new Request(url, options);
        const requestClone = request.clone();
        
        this.history.push({ role: 'user', content: historyPrompt });

        try {
            const response = await fetch(request);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error("Error response from server:", errorText);
                await this.recordRequest(requestClone, response, errorText);
                throw new HttpError(`Failed to run turn: ${response.statusText}`, response.status);
            }

            const responseData = await response.json();
            const agentResponse = this.agentType === 'a2a' ? responseData.text : responseData.response;

            this.history.push({ role: 'model', content: agentResponse });
            
            await this.recordRequest(requestClone, response, JSON.stringify(responseData));

            return agentResponse;
        } finally {
            clearTimeout(timeoutId);
        }
    }
}

export default Session;