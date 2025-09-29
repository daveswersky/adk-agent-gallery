
import { v4 as uuidv4 } from 'uuid';
import { ChatMessage } from '../types';

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
        const url = `${this.agentUrl}/apps/${this.agentName}/users/${this.userId}/sessions/${this.sessionId}`;
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        };

        console.log('Creating session:', { url, options });

        const response = await fetch(url, options);

        if (!response.ok) {
            throw new Error(`Failed to create session: ${response.statusText}`);
        }
    }

    async runTurn(prompt: string): Promise<string> {
        const url = `${this.agentUrl}/run`;
        const body = {
            app_name: this.agentName,
            user_id: this.userId,
            session_id: this.sessionId,
            new_message: {
                role: 'user',
                parts: [{
                    text: prompt,
                }],
            },
        };
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        };

        const response = await fetch(url, options);

        if (!response.ok) {
            throw new Error(`Failed to run turn: ${response.statusText}`);
        }

        const data = await response.json();
        
        // The ADK server returns the response in an array.
        if (Array.isArray(data) && data.length > 0) {
            const firstEvent = data[0];
            if (firstEvent.content && firstEvent.content.parts && firstEvent.content.parts.length > 0) {
                const responseText = firstEvent.content.parts[0].text;
                
                // Add both user and model messages to history
                this.history.push({ role: 'user', content: prompt });
                this.history.push({ role: 'model', content: responseText });

                return responseText;
            }
        }
        
        // Handle cases where the response might be structured differently or missing.
        console.error("Unexpected response format from agent:", data);
        throw new Error("Invalid or unexpected response format from agent.");
    }
}

export default Session;
