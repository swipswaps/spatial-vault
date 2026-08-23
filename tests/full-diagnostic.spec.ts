import { test, expect } from '@playwright/test';

test('diagnostic: video URL changes', async ({ page }) => {
  const port = process.env.VITE_PORT || '5173';
  const url = `http://localhost:${port}`;
  console.log(`🌐 Navigating to ${url}`);

  const logs: string[] = [];
  const network: string[] = [];

  // Capture console logs
  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`;
    logs.push(text);
    console.log(text);
  });

  // Capture network requests
  page.on('request', req => {
    network.push(`REQ: ${req.method()} ${req.url()}`);
  });
  page.on('response', res => {
    network.push(`RES: ${res.status()} ${res.url()}`);
  });

  // Set folder path
  await page.addInitScript(() => {
    (window as any).__FOLDER_PATH = '/home/owner/Pictures/Screenshots';
  });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log('✅ Page loaded');

  // Wait for thumbnails or fallback
  const gridSelector = '[style*="grid-template-columns: repeat(auto-fill, minmax(120px, 1fr))"]';
  const buttonSelector = 'button:has-text("📁 Select Screenshots Folder")';

  let hasThumbnails = false;
  try {
    await page.waitForSelector(gridSelector, { timeout: 15000 });
    const count = await page.evaluate((sel) => {
      const container = document.querySelector(sel);
      return container ? container.children.length : 0;
    }, gridSelector);
    if (count > 0) {
      hasThumbnails = true;
      console.log(`✅ ${count} thumbnails loaded automatically`);
    }
  } catch {
    console.log('⚠️ No thumbnails auto-loaded. Checking for fallback button...');
    const button = page.locator(buttonSelector);
    if (await button.isVisible()) {
      console.log('📁 Fallback button visible – user can manually select folder.');
    } else {
      console.log('⚠️ No thumbnails and no fallback button. Check folder path.');
    }
  }

  // Click first thumbnail if available
  if (hasThumbnails) {
    const firstThumbnail = page.locator('[style*="cursor: pointer"]').first();
    await expect(firstThumbnail).toBeVisible({ timeout: 5000 });
    await firstThumbnail.click({ force: true });
    console.log('🖱️ Clicked first thumbnail');

    // Wait for video URL change log
    await page.waitForTimeout(2000);
    const videoLogs = logs.filter(l => l.includes('Video URL changed to'));
    if (videoLogs.length > 0) {
      console.log('\n=== VIDEO URL CHANGE LOGS ===');
      videoLogs.forEach(l => console.log(l));
      console.log('=== END VIDEO LOGS ===\n');
    } else {
      console.log('⚠️ No video URL change logs found.');
    }

    // Check video player
    try {
      await page.waitForSelector('iframe[src*="youtube"], video', { timeout: 10000 });
      console.log('✅ Video player loaded.');
    } catch {
      console.log('⚠️ Video player did not appear.');
    }
  }

  // Print network logs
  console.log('\n=== NETWORK LOGS ===');
  network.forEach(l => console.log(l));

  // Print all console logs
  console.log('\n=== FULL CONSOLE LOG ===');
  logs.forEach(l => console.log(l));

  console.log('🎉 Diagnostic complete.');
});
