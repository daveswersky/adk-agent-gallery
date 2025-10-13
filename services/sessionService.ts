import { v4 as uuidv4 } from 'uuid';
import { ChatMessage, RequestRecord, HttpError } from '../types';
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
    private agentName: string;
    private userId: string;
    public history: ChatMessage[] = [];
    public requestHistory: RequestRecord[] = [];

    constructor(agentName: string) {
        this.sessionId = uuidv4();
        this.agentName = agentName;
        this.userId = "forusone";
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

    async *runTurn(prompt: string, file: File | null = null): AsyncGenerator<AgentEvent> {
        const url = `${API_BASE_URL}/run_turn`;
        
        const parts: Array<any> = [{ text: prompt }];
        let historyPrompt = prompt;

        if (file) {
            try {
                const base64String = await fileToBase64(file);
                parts.push({
                    inline_data: {
                        mime_type: file.type,
                        data: base64String,
                        display_name: file.name,
                    },
                });
                // Add a reference to the file in the prompt for history
                historyPrompt += `\n[File attached: ${file.name}]`;
            } catch (error) {
                console.error("Error encoding file to Base64:", error);
                throw new Error("Failed to process file for upload.");
            }
        }

        const body = {
            agent_name: this.agentName,
            prompt: prompt,
        };
        const options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        };

        const request = new Request(url, options);
        const requestClone = request.clone();
        
        this.history.push({ role: 'user', content: historyPrompt });

        const response = await fetch(request);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error("Error response from server:", errorText);
            await this.recordRequest(requestClone, response, errorText);
            throw new HttpError(response.status, `Failed to run turn: ${response.statusText}`);
        }

        const responseData = await response.json();
        const agentResponse = responseData.response;
        const events = responseData.events || [];

        for (const event of events) {
            if (event.type === 'tool_start') {
                this.history.push({ role: 'tool', content: `Calling tool: ${event.tool_name}\nArguments:\n${event.tool_input}` });
                yield { type: 'tool_call', content: { name: event.tool_name, args: event.tool_input } };
            } else if (event.type === 'tool_end') {
                this.history.push({ role: 'tool', content: `Tool ${event.tool_name} returned:\n${event.tool_output}` });
                yield { type: 'tool_result', name: event.tool_name, content: event.tool_output };
            }
        }

        this.history.push({ role: 'model', content: agentResponse });
        
        await this.recordRequest(requestClone, response, JSON.stringify(responseData));

        yield { type: 'final_answer', content: agentResponse };
    }
}

export default Session;