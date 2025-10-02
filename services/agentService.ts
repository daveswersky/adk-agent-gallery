import type { Agent } from '../types';
import { HttpError } from '../types';

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
