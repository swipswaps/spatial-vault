import { test, expect } from '@playwright/test';

test('test thumbnail folder selection', async ({ page }) => {
  // Auto-detect port
  let url = '';
  for (const port of [5173, 5174, 5175, 5176, 5177, 5178, 5179, 5180]) {
    try {
      await page.goto(`http://localhost:${port}`, { timeout: 2000 });
      url = `http://localhost:${port}`;
      console.log(`✅ Connected to ${url}`);
      break;
    } catch {}
  }
  if (!url) throw new Error('No Vite server found');

  // Capture console logs
  page.on('console', msg => {
    console.log(`[${msg.type()}] ${msg.text()}`);
  });

  // Click the "Select Screenshots Folder" button
  const button = page.getByText('📁 Select Screenshots Folder');
  await expect(button).toBeVisible({ timeout: 10000 });
  console.log('✅ Button found');
  
  // Clicking the button triggers the file picker – we cannot automate this in headless.
  // So we just check that the button exists.
  // We'll rely on the user to manually test and check console.
  // But we can also capture the logs after the user interacts.
  // For now, we just log that the button is present.

  await page.waitForTimeout(5000);
});
