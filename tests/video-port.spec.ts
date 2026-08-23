import { test, expect } from '@playwright/test';

test('video loads with react-player', async ({ page }) => {
  const url = 'http://localhost:5174';
  console.log('🌐 Navigating to', url);

  await page.goto(url, { timeout: 10000 });
  console.log('✅ Page loaded');

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
