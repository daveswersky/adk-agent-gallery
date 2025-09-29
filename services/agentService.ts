
/**
 * Sends a prompt to a running ADK agent and returns the model's response.
 * @param agentUrl - The base URL of the agent server.
 * @param prompt - The user's prompt to send.
 * @returns A promise that resolves to the agent's string response.
 */
export const runTurn = async (agentUrl: string, prompt: string): Promise<string> => {
  try {
    const response = await fetch(agentUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Agent API request failed with status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    if (typeof data.response !== 'string') {
        throw new Error('Invalid response format from agent.');
    }

    return data.response;
  } catch (error) {
    console.error("Error in runTurn:", error);
    if (error instanceof Error) {
        return `Error communicating with agent: ${error.message}`;
    }
    return "An unknown error occurred while communicating with the agent.";
  }
};
