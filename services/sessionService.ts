import { v4 as uuidv4 } from 'uuid';
import { ChatMessage } from '../types';

// This type is now only used by the UI component
export type LoadingStatus = {
    type: 'thinking' | 'tool_use';
    message: string;
};

// A type for the events we yield from the stream
export type AgentEvent = {
    type: 'tool_call' | 'final_answer' | 'error';
    content: any;
};

class Session {
    public sessionId: string;
    private agentUrl: string;
    private agentName: string;
    private userId: string;
    public history: ChatMessage[] = [];

    constructor(agentUrl: string, agentName: string) {
        this.sessionId = uuidv4();
        this.agentUrl = agentUrl;
        this.agentName = agentName;
        this.userId = "forusone";
    }

    async create(): Promise<void> {
        const url = `${this.agentUrl}/apps/${this.agentName.replace(/-/g, '_')}/users/${this.userId}/sessions/${this.sessionId}`;
        const options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        };
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`Failed to create session: ${response.statusText}`);
        }
    }

    private formatToolResponse(text: string): string {
        const toolReportRegex = /(?:\\\[.*?\\\\]|\\w+)\\s+tool reported:\\s*/s;
        if (toolReportRegex.test(text)) {
            const parts = text.split(toolReportRegex);
            const introText = parts[0].trim();
            const resultsText = parts.slice(1).join('').trim();
            return `${introText}\n\nHere are the results:\n${resultsText}`;
        }
        return text;
    }

    async *runTurn(prompt: string): AsyncGenerator<AgentEvent> {
        const url = `${this.agentUrl}/run`;
        const body = {
            app_name: this.agentName.replace(/-/g, '_'),
            user_id: this.userId,
            session_id: this.sessionId,
            new_message: { role: 'user', parts: [{ text: prompt }] },
            stream: true,
        };
        const options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        };

        const response = await fetch(url, options);
        if (!response.ok || !response.body) {
            const errorText = await response.text();
            console.error("Error response from server:", errorText);
            throw new Error(`Failed to run turn: ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const processLine = function*(line: string): Generator<any> {
            if (line.trim() === '') return;
            try {
                const parsed = JSON.parse(line);
                if (Array.isArray(parsed)) {
                    for (const event of parsed) {
                        yield event;
                    }
                } else {
                    yield parsed;
                }
            } catch (e) {
                console.error("Failed to parse streaming event:", e, "Line:", line);
            }
        };

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                for (const event of processLine(line)) {
                    if (event.content?.parts) {
                        const part = event.content.parts[0];
                        if (part.functionCall) {
                            yield { type: 'tool_call', content: part.functionCall };
                        }
                        if (part.text) {
                            const formattedAnswer = this.formatToolResponse(part.text);
                            this.history.push({ role: 'user', content: prompt });
                            this.history.push({ role: 'model', content: formattedAnswer });
                            yield { type: 'final_answer', content: formattedAnswer };
                        }
                    }
                }
            }
        }
        // Final buffer processing
        if (buffer.trim()) {
            for (const event of processLine(buffer)) {
                 if (event.content?.parts) {
                    const part = event.content.parts[0];
                    if (part.functionCall) {
                        yield { type: 'tool_call', content: part.functionCall };
                    }
                    if (part.text) {
                        const formattedAnswer = this.formatToolResponse(part.text);
                        this.history.push({ role: 'user', content: prompt });
                        this.history.push({ role: 'model', content: formattedAnswer });
                        yield { type: 'final_answer', content: formattedAnswer };
                    }
                }
            }
        }
    }
}

export default Session;