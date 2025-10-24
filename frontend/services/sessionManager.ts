import Session from './sessionService';
import { Agent } from '../types';

class SessionManager {
    public sessions: Map<string, Session> = new Map();

    async getSession(agent: Agent): Promise<Session> {
        if (this.sessions.has(agent.id)) {
            return this.sessions.get(agent.id)!;
        }

        const newSession = new Session(agent.id, agent.name, agent.type, agent.url);
        this.sessions.set(agent.id, newSession);
        return newSession;
    }

    getSessionDetails() {
        return Array.from(this.sessions.entries()).map(([agentId, session]) => ({
            agentId,
            sessionId: session.sessionId, // Accessing private property for display
            historyCount: session.history.length,
            requestHistory: session.requestHistory,
        }));
    }
}

// Export a singleton instance of the session manager
export const sessionManager = new SessionManager();
