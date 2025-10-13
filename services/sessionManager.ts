import Session from './sessionService';
import { Agent } from '../types';

class SessionManager {
    public sessions: Map<string, Session> = new Map();

    async getSession(agentName: string): Promise<Session> {
        if (this.sessions.has(agentName)) {
            return this.sessions.get(agentName)!;
        }

        const newSession = new Session(agentName);
        this.sessions.set(agentName, newSession);
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
