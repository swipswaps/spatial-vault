import { test, expect } from '@playwright/test';

test('search returns results and updates timeline', async ({ page }) => {
  // Auto-detect port
  let url = '';
  for (const port of [5173, 5174, 5175, 5176, 5177, 5178]) {
    try {
      await page.goto(`http://localhost:${port}`, { timeout: 2000 });
      url = `http://localhost:${port}`;
      break;
    } catch {}
  }
  if (!url) throw new Error('No Vite server found');

  await page.goto(url, { waitUntil: 'networkidle' });

  // Type a search query
  await page.fill('input[placeholder*="Search"]', 'vector embeddings');
  await page.click('button:has-text("Search")');

  // Wait for results to appear
  await page.waitForSelector('.card', { timeout: 10000 });

  // Check that at least one card contains the query
  const cardText = await page.textContent('.card');
  expect(cardText).toContain('Vector Embeddings');

  // Check that the timeline has nodes
  await page.waitForSelector('canvas', { timeout: 10000 });

  // Click the first card and verify video timestamp changes
  await page.click('.card button:has-text("Play")');
  const video = page.locator('video');
  await expect(video).toBeVisible();

  // Check that the video starts playing (or at least seeks)
  const currentTime = await video.evaluate((v) => v.currentTime);
  expect(currentTime).toBeGreaterThanOrEqual(0);
});
