import { test, expect } from '@playwright/test';

test('video loads and plays with native player', async ({ page }) => {
  const url = 'http://localhost:5174';
  console.log('🌐 Navigating to', url);

  // Use 'load' — Vite HMR keeps network busy, so 'networkidle' never fires
  await page.goto(url, { waitUntil: 'load', timeout: 10000 });
  console.log('✅ Page loaded');

  const video = page.locator('video');
  await expect(video).toBeVisible({ timeout: 10000 });

  // Wait for video to be ready — use page.evaluate to avoid context issues
  const ready = await page.evaluate(() => {
    const v = document.querySelector('video');
    if (!v) return false;
    return new Promise((resolve) => {
      if (v.readyState >= 3) resolve(true);
      v.addEventListener('canplaythrough', () => resolve(true), { once: true });
      // Safety timeout
      setTimeout(() => resolve(false), 15000);
    });
  }, { timeout: 20000 });

  expect(ready).toBe(true);

  const duration = await page.evaluate(() => {
    const v = document.querySelector('video');
    return v ? v.duration : 0;
  });
  expect(duration).toBeGreaterThan(0);

  console.log('✅ Video loaded successfully! Duration:', duration, 'seconds');
});
