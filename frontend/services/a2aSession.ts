import { BaseSession } from './baseSession';
import { HttpError } from '../types';

export class A2aSession extends BaseSession {
    constructor(agentId: string, agentName: string, agentType: 'adk' | 'a2a', agentUrl?: string) {
        super(agentId, agentName, agentType, agentUrl);
        this.createA2ASession();
    }

    private async createA2ASession(): Promise<void> {
        if (!this.agentUrl) {
            console.error("Cannot create A2A session: agent URL is not defined.");
            return;
        }
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

    async runTurn(prompt: string, file: File | null = null): Promise<string> {
        if (!this.agentUrl) {
            throw new Error("Agent URL is not available.");
        }
        const url = `${this.agentUrl}/run`;
        
        let historyPrompt = prompt;
        if (file) {
            historyPrompt += `\n[File attached: ${file.name}]`;
        }

        const body = {
            appName: this.agentName,
            userId: this.userId,
            sessionId: this.sessionId,
            newMessage: { parts: [{ text: prompt }] }
        };

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
            
            // Find the last event with a text part in the content
            let agentResponse = '';
            if (Array.isArray(responseData)) {
                for (let i = responseData.length - 1; i >= 0; i--) {
                    const event = responseData[i];
                    if (event.content && event.content.parts && event.content.parts.length > 0) {
                        const textPart = event.content.parts.find((part: any) => 'text' in part);
                        if (textPart) {
                            agentResponse = textPart.text;
                            break;
                        }
                    }
                }
            }

            this.history.push({ role: 'model', content: agentResponse });
            
            await this.recordRequest(requestClone, response, JSON.stringify(responseData));

            return agentResponse;
        } finally {
            clearTimeout(timeoutId);
        }
    }
}
