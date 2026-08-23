import { test, expect } from '@playwright/test';

test('full workflow: backend, thumbnails, video', async ({ page }) => {
  const port = process.env.VITE_PORT || '5173';
  const url = `http://localhost:${port}`;
  console.log(`🌐 Navigating to ${url}`);

  const logs: string[] = [];
  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`;
    logs.push(text);
    console.log(text);
  });

  await page.addInitScript(() => {
    (window as any).__FOLDER_PATH = '/home/owner/Pictures/Screenshots';
  });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log('✅ Page loaded');

  // Gate 1: React root
  expect(await page.evaluate(() => !!document.getElementById('root'))).toBe(true);
  console.log('✅ React root exists');

  // Gate 2: Backend connected
  await page.waitForSelector('.status-badge', { timeout: 10000 });
  const status = await page.textContent('.status-badge');
  expect(status).toContain('Active');
  console.log('✅ Backend connected');

  // Gate 3: Thumbnails grid
  const grid = '[style*="grid-template-columns: repeat(auto-fill, minmax(120px, 1fr))"]';
  await page.waitForSelector(grid, { timeout: 15000 });
  const count = await page.evaluate((sel) => {
    const c = document.querySelector(sel);
    return c ? c.children.length : 0;
  }, grid);
  expect(count).toBeGreaterThan(0);
  console.log(`✅ ${count} thumbnails loaded`);

  // Gate 4: Thumbnails are from your folder (alt text contains 'youtu.be')
  const altTexts = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('img[alt*="youtu.be"]')).map(img => img.getAttribute('alt'));
  });
  expect(altTexts.length).toBeGreaterThan(0);
  console.log(`✅ ${altTexts.length} thumbnails from screenshots (e.g. ${altTexts[0]})`);

  // Gate 5: Click first thumbnail
  const first = page.locator('[style*="cursor: pointer"]').first();
  await first.click({ force: true });
  console.log('🖱️ Clicked first thumbnail');

  // Gate 6: Video URL changed
  await page.waitForTimeout(2000);
  const videoLogs = logs.filter(l => l.includes('Video URL changed to'));
  expect(videoLogs.length).toBeGreaterThan(0);
  console.log(`✅ Video URL changed (${videoLogs.length} logs)`);

  // Gate 7: Video player loaded
  const hasPlayer = await page.locator('iframe[src*="youtube"], video').count() > 0;
  expect(hasPlayer).toBe(true);
  console.log('✅ Video player loaded');

  console.log('\n🎉 ALL GATES PASSED');
});
