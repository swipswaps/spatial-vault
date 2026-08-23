import { test, expect } from '@playwright/test';

test('gated: backend connected, thumbnails load, video plays', async ({ page }) => {
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

  // ---- GATE 1: React root ----
  const rootExists = await page.evaluate(() => !!document.getElementById('root'));
  expect(rootExists).toBe(true);
  console.log('✅ React root exists');

  // ---- GATE 2: Backend status badge must say "Active" ----
  await page.waitForSelector('.status-badge', { timeout: 10000 });
  const statusText = await page.textContent('.status-badge');
  console.log('📊 Backend status:', statusText);
  expect(statusText).toContain('Active');
  console.log('✅ Backend is connected');

  // ---- GATE 3: Thumbnails grid must appear ----
  const gridSelector = '[style*="grid-template-columns: repeat(auto-fill, minmax(120px, 1fr))"]';
  await page.waitForSelector(gridSelector, { timeout: 15000 });
  const count = await page.evaluate((sel) => {
    const container = document.querySelector(sel);
    return container ? container.children.length : 0;
  }, gridSelector);
  expect(count).toBeGreaterThan(0);
  console.log(`✅ ${count} thumbnails loaded`);

  // ---- GATE 4: Click first thumbnail ----
  const firstThumbnail = page.locator('[style*="cursor: pointer"]').first();
  await expect(firstThumbnail).toBeVisible({ timeout: 5000 });
  await firstThumbnail.click({ force: true });
  console.log('🖱️ Clicked first thumbnail');

  // ---- GATE 5: Video URL changed ----
  await page.waitForTimeout(2000);
  const videoLogs = logs.filter(l => l.includes('Video URL changed to'));
  expect(videoLogs.length).toBeGreaterThan(0);
  console.log(`✅ Video URL changed (${videoLogs.length} logs)`);

  // ---- GATE 6: Video player loaded ----
  const iframe = page.locator('iframe[src*="youtube"]');
  const videoElement = page.locator('video');
  const hasPlayer = (await iframe.count() > 0) || (await videoElement.count() > 0);
  expect(hasPlayer).toBe(true);
  console.log('✅ Video player loaded');

  // ---- Print all logs for reference ----
  console.log('\n=== FULL CONSOLE LOG ===');
  logs.forEach(l => console.log(l));

  console.log('\n🎉 ALL GATES PASSED');
});
