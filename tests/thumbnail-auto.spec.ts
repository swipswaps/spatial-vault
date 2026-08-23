import { test, expect } from '@playwright/test';

test('load thumbnails from mounted folder', async ({ page }) => {
  const port = process.env.VITE_PORT || '5173';
  const url = `http://localhost:${port}`;
  console.log(`🌐 Navigating to ${url} (using VITE_PORT=${port})`);

  // Capture console logs
  const logs: string[] = [];
  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`;
    logs.push(text);
    console.log(text);
  });

  // Set folder path
  await page.addInitScript(() => {
    (window as any).__FOLDER_PATH = '/home/owner/Pictures/Screenshots';
  });

  // Navigate with generous timeout
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log('✅ Page loaded');

  // Wait for React to render
  await page.waitForTimeout(3000);

  // Check for thumbnails
  const hasThumbnails = await page.evaluate(() => {
    const container = document.querySelector('[style*="grid-template-columns: repeat(auto-fill, minmax(120px, 1fr))"]');
    return container ? container.children.length > 0 : false;
  });

  if (hasThumbnails) {
    console.log('✅ Thumbnails loaded successfully!');
  } else {
    const errorMsg = await page.evaluate(() => {
      const el = document.querySelector('[style*="color: #f87171"]');
      return el ? el.textContent : null;
    });
    if (errorMsg) {
      console.log('❌ Error message:', errorMsg);
    } else {
      console.log('⚠️ No thumbnails loaded. Check console logs above.');
    }
  }

  // Print all logs
  console.log('=== FULL CONSOLE LOG ===');
  logs.forEach(l => console.log(l));
});
