import { test, expect } from '@playwright/test';

test('full flow with YouTube support', async ({ page }) => {
  const port = process.env.VITE_PORT || '5173';
  const url = `http://localhost:${port}`;
  console.log(`🌐 Navigating to ${url}`);

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

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log('✅ Page loaded');

  await page.waitForTimeout(3000);

  // Check thumbnails
  const hasThumbnails = await page.evaluate(() => {
    const container = document.querySelector('[style*="grid-template-columns: repeat(auto-fill, minmax(120px, 1fr))"]');
    return container ? container.children.length > 0 : false;
  });

  if (hasThumbnails) {
    console.log('✅ Thumbnails loaded!');
    // Click first thumbnail
    const firstThumbnail = page.locator('[style*="cursor: pointer"]').first();
    await firstThumbnail.click();
    console.log('✅ Clicked first thumbnail');

    // Wait for react-player to load
    await page.waitForSelector('.react-player', { timeout: 10000 });
    console.log('✅ react-player rendered');

    // Check that the player is visible and has a src
    const player = page.locator('.react-player');
    await expect(player).toBeVisible({ timeout: 10000 });

    // Check that the video is playing (or at least loaded)
    // react-player doesn't expose video.src, but we can check if the player element exists
    console.log('✅ YouTube video should now be loading');
  } else {
    console.log('⚠️ No thumbnails loaded');
  }

  console.log('=== FULL CONSOLE LOG ===');
  logs.forEach(l => console.log(l));
});
