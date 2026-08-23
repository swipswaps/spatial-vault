import { test, expect } from '@playwright/test';

test('video loads with react-player', async ({ page }) => {
  // Try both ports
  let url = 'http://localhost:5173';
  try {
    await page.goto(url, { timeout: 2000 });
  } catch {
    url = 'http://localhost:5174';
    await page.goto(url);
  }

  console.log(`🌐 Navigated to ${url}`);

  const video = page.locator('video');
  await expect(video).toBeVisible({ timeout: 10000 });

  await video.evaluate((v) => {
    return new Promise((resolve) => {
      if (v.readyState >= 3) resolve(true);
      v.addEventListener('canplaythrough', () => resolve(true), { once: true });
    });
  }, { timeout: 20000 });

  const duration = await video.evaluate((v) => v.duration);
  expect(duration).toBeGreaterThan(0);

  console.log('✅ Video loaded successfully!');
});
