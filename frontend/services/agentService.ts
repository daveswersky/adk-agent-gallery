import type { Agent, AgentCode } from '../types';
import { HttpError } from '../types';
import { API_BASE_URL } from '../config';

export const getAgentCode = async (agentId: string): Promise<AgentCode> => {
  try {
    const encodedAgentId = encodeURIComponent(agentId);
    const response = await fetch(`${API_BASE_URL}/agents/${encodedAgentId}/code`);
    if (!response.ok) {
      throw new HttpError(`HTTP error! status: ${response.status}`, response.status);
    }
    const data = await response.json();
    return data as AgentCode;
  } catch (error) {
    console.error(`Error fetching code for agent ${agentId}:`, error);
    throw error;
  }
};

export const causeError = async (agent: Agent): Promise<void> => {
  try {
    const response = await fetch(`${agent.url}/nonexistent-endpoint`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: '/error' }),
    });
    if (!response.ok) {
      throw new HttpError(`HTTP error! status: ${response.status}`, response.status);
    }
  } catch (error) {
    console.error('Error caused deliberately:', error);
    throw error;
  }
};
