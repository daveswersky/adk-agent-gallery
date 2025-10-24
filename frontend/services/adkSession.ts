import { BaseSession } from './baseSession';
import { HttpError } from '../types';
import { API_BASE_URL } from '../config';

export class AdkSession extends BaseSession {
    constructor(agentId: string, agentName: string, agentType: 'adk' | 'a2a', agentUrl?: string) {
        super(agentId, agentName, agentType, agentUrl);
    }

    async runTurn(prompt: string, file: File | null = null): Promise<string> {
        const url = `${API_BASE_URL}/run_turn`;
        
        let historyPrompt = prompt;
        if (file) {
            historyPrompt += `\n[File attached: ${file.name}]`;
        }

        const body = { agent_name: this.agentId, prompt: prompt };

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
            const agentResponse = responseData.response;

            this.history.push({ role: 'model', content: agentResponse });
            
            await this.recordRequest(requestClone, response, JSON.stringify(responseData));

            return agentResponse;
        } finally {
            clearTimeout(timeoutId);
        }
    }
}
