import { Agent } from '../types';

export async function runTurn(
  agent: Agent,
  prompt: string
): Promise<string> {
  if (!agent.url) {
    throw new Error('Agent URL is not available.');
  }

  try {
    const response = await fetch(agent.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Agent request failed with status ${response.status}: ${errorText}`
      );
    }

    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error('Error in runTurn:', error);
    throw error;
  }
}
