const API_BASE_URL = 'http://localhost:8000';

export const updatePinnedAgents = async (agentId: string, pin: boolean): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/config/pinned_agents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agent_id: agentId,
        pin: pin,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to update pinned agents');
    }
  } catch (error) {
    console.error('Error updating pinned agents:', error);
    // Re-throw the error so the calling component can handle it
    throw error;
  }
};
