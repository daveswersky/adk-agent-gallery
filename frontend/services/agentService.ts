import type { Agent, AgentCodeFile, AgentCodeComplex } from '../types';
import { HttpError } from '../types';
import { API_BASE_URL } from '../config';

export const getAgentCode = async (agentId: string): Promise<AgentCodeFile> => {
  try {
    const encodedAgentId = encodeURIComponent(agentId);
    const response = await fetch(`${API_BASE_URL}/agents/${encodedAgentId}/code`);
    if (!response.ok) {
      throw new HttpError(`HTTP error! status: ${response.status}`, response.status);
    }
    const data = await response.json();
    return data as AgentCodeFile;
  } catch (error) {
    console.error(`Error fetching code for agent ${agentId}:`, error);
    throw error;
  }
};

export const getAgentCodeWithSubagents = async (agentId: string): Promise<AgentCodeComplex> => {
  try {
    const encodedAgentId = encodeURIComponent(agentId);
    const response = await fetch(`${API_BASE_URL}/agents/${encodedAgentId}/code_with_subagents`);
    if (!response.ok) {
      throw new HttpError(`HTTP error! status: ${response.status}`, response.status);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching code for agent ${agentId} with subagents:`, error);
    throw error;
  }
};

export const getAgentReadme = async (agentId: string): Promise<string> => {
  try {
    const encodedAgentId = encodeURIComponent(agentId);
    const response = await fetch(`${API_BASE_URL}/agents/${encodedAgentId}/readme`);
    if (!response.ok) {
      throw new HttpError(`HTTP error! status: ${response.status}`, response.status);
    }
    const data = await response.json();
    return data.content;
  } catch (error) {
    console.error(`Error fetching README for agent ${agentId}:`, error);
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
