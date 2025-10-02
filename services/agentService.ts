import type { Agent } from '../types';
import { HttpError, UploadHttpError } from '../types';

export const uploadFile = async (agent: Agent, file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);
  const url = `${agent.url}/upload`;
  const request = new Request(url, {
    method: 'POST',
    body: formData,
  });
  const requestClone = request.clone();

  try {
    const response = await fetch(request);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new UploadHttpError(`HTTP error! status: ${response.status}, body: ${errorBody}`, response.status, requestClone);
    }

    const result = await response.json();
    if (result && result.filename) {
      return result.filename;
    } else {
      throw new UploadHttpError('Invalid response from upload endpoint', response.status, requestClone);
    }
  } catch (error) {
    console.error('File upload error:', error);
    if (error instanceof UploadHttpError) {
      throw error;
    }
    throw new UploadHttpError(error instanceof Error ? error.message : 'Unknown upload error', 0, requestClone);
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
