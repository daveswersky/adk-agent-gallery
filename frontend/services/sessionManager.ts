import { AdkSession } from './adkSession';
import { A2aSession } from './a2aSession';
import { BaseSession } from './baseSession';
import { Agent } from '../types';

class SessionManager {
    public sessions: Map<string, BaseSession> = new Map();

    async getSession(agent: Agent): Promise<BaseSession> {
        if (this.sessions.has(agent.id)) {
            return this.sessions.get(agent.id)!;
        }

        let newSession: BaseSession;
        if (agent.type === 'a2a') {
            newSession = new A2aSession(agent.id, agent.name, agent.type, agent.url);
        } else {
            newSession = new AdkSession(agent.id, agent.name, agent.type, agent.url);
        }
        
        this.sessions.set(agent.id, newSession);
        return newSession;
    }

    clearSession(agentId: string): void {
        this.sessions.delete(agentId);
    }

    getSessionDetails() {
        return Array.from(this.sessions.entries()).map(([agentId, session]) => ({
            agentId,
            sessionId: session.sessionId,
            historyCount: session.history.length,
            requestHistory: session.requestHistory,
        }));
    }
}

// Export a singleton instance of the session manager
export const sessionManager = new SessionManager();
