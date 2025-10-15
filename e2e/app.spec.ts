// e2e/app.spec.ts
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  
  const agentId = 'greeting_agent';
  const agentStatus = page.getByTestId(`agent-status-${agentId}`).locator('span');
  const stopButton = page.getByTestId(`stop-agent-${agentId}`);

  await expect(agentStatus).toBeVisible();
  const currentStatus = await agentStatus.textContent();

  if (currentStatus !== 'STOPPED') {
    // If it's STARTING, wait for it to become RUNNING first.
    if (currentStatus === 'STARTING') {
      await expect(agentStatus).toHaveText('RUNNING', { timeout: 30000 });
    }
    
    // Now that we know it's running, click its stop button.
    await stopButton.click();
    
    // Wait for the intermediate 'STOPPING' state first.
    await expect(agentStatus).toHaveText('STOPPING', { timeout: 10000 });

    // THEN wait for the final 'STOPPED' state.
    await expect(agentStatus).toHaveText('STOPPED', { timeout: 10000 });
  }
});

test('Full agent lifecycle UI test', async ({ page }) => {
  // The page is already loaded by the beforeEach hook.
  await expect(page).toHaveTitle(/Agent Gallery/);

  const agentId = 'greeting_agent';

  // 2. Verify initial state
  const agentCard = page.getByTestId(`agent-card-${agentId}`);
  const startButton = page.getByTestId(`start-agent-${agentId}`);
  const stopButton = page.getByTestId(`stop-agent-${agentId}`);
  const agentStatus = page.getByTestId(`agent-status-${agentId}`);
  const chatInput = page.getByTestId('chat-input');

  await expect(agentCard).toBeVisible();
  await expect(agentStatus.locator('span')).toHaveText('STOPPED');
  // Assert that the chat input does NOT exist initially
  await expect(chatInput).not.toBeVisible();

  // 3. Start the agent
  await startButton.click();

  // 4. Verify agent is running and select it
  await expect(agentStatus.locator('span')).toHaveText('RUNNING', { timeout: 30000 });
  await expect(stopButton).toBeVisible();

  // NEW STEP: Click the agent card to select it and show the chat interface
  await agentCard.click();
  
  // Now the chat input should be visible and enabled
  await expect(chatInput).toBeVisible();
  await expect(chatInput).toBeEnabled();

  const infoPane = page.getByTestId('info-pane-logs');
  await expect(infoPane).toContainText(/Agent startup process started/);

  // 5. Interact with the agent
  await chatInput.fill('Hello');
  await page.getByTestId('send-button').click();

  // 6. Verify agent response and event stream
  const chatHistory = page.getByTestId('chat-history');
  // Wait for the agent's message to appear in the chat history.
  // An agent message is a div with the 'justify-start' class within the chat history.
  const agentMessage = chatHistory.locator('div.justify-start');
  await expect(agentMessage).toBeVisible();

  // 7. Stop the agent
  await stopButton.click();

  // 8. Verify agent is stopped by waiting for the UI to update
  await expect(agentStatus.locator('span')).toHaveText('STOPPING', { timeout: 10000 });
  await expect(agentStatus.locator('span')).toHaveText('STOPPED', { timeout: 10000 });
  
  await expect(startButton).toBeVisible();
  // The chat interface should disappear again
  await expect(chatInput).not.toBeVisible();
  await expect(infoPane).toContainText(/Status \[greeting_agent\]: STOPPED/);
});