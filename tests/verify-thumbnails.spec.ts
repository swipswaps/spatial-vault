import { test, expect } from '@playwright/test';

test('verify thumbnails are from screenshots folder', async ({ page }) => {
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

  // ---- React root ----
  const rootExists = await page.evaluate(() => !!document.getElementById('root'));
  expect(rootExists).toBe(true);
  console.log('✅ React root exists');

  // ---- Backend status badge ----
  await page.waitForSelector('.status-badge', { timeout: 10000 });
  const statusText = await page.textContent('.status-badge');
  expect(statusText).toContain('Active');
  console.log('✅ Backend connected');

  // ---- Thumbnails grid ----
  const gridSelector = '[style*="grid-template-columns: repeat(auto-fill, minmax(120px, 1fr))"]';
  await page.waitForSelector(gridSelector, { timeout: 15000 });
  console.log('✅ Thumbnail grid appeared');

  // ---- VERIFY: Thumbnails are from your folder ----
  // Get all image alt attributes (filenames)
  const altTexts = await page.evaluate(() => {
    const images = document.querySelectorAll('img[alt*="youtu.be"]');
    return Array.from(images).map(img => img.getAttribute('alt'));
  });

  console.log(`📸 Found ${altTexts.length} thumbnails with 'youtu.be' in alt text`);
  if (altTexts.length > 0) {
    console.log(`   Example: ${altTexts[0]}`);
  }

  // At least one thumbnail must have the expected pattern
  const hasValid = altTexts.some(alt => alt && alt.includes('?t='));
  expect(hasValid).toBe(true);
  console.log('✅ Thumbnails are from your screenshots folder');

  // ---- Click first thumbnail ----
  const firstThumbnail = page.locator('[style*="cursor: pointer"]').first();
  await expect(firstThumbnail).toBeVisible({ timeout: 5000 });
  await firstThumbnail.click({ force: true });
  console.log('🖱️ Clicked first thumbnail');

  // ---- Video URL changed ----
  await page.waitForTimeout(2000);
  const videoLogs = logs.filter(l => l.includes('Video URL changed to'));
  expect(videoLogs.length).toBeGreaterThan(0);
  console.log(`✅ Video URL changed (${videoLogs.length} logs)`);

  // ---- Video player loaded ----
  const iframe = page.locator('iframe[src*="youtube"]');
  const videoElement = page.locator('video');
  const hasPlayer = (await iframe.count() > 0) || (await videoElement.count() > 0);
  expect(hasPlayer).toBe(true);
  console.log('✅ Video player loaded');

  // ---- Print all logs ----
  console.log('\n=== FULL CONSOLE LOG ===');
  logs.forEach(l => console.log(l));

  console.log('\n🎉 ALL GATES PASSED');
});
