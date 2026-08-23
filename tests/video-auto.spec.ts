import { test, expect } from '@playwright/test';

test('video loads and plays with Video.js', async ({ page }) => {
  // Auto‑detect Vite port (5173–5177)
  let url = '';
  for (const port of [5173, 5174, 5175, 5176, 5177]) {
    try {
      await page.goto(`http://localhost:${port}`, { timeout: 2000 });
      url = `http://localhost:${port}`;
      console.log(`✅ Connected to ${url}`);
      break;
    } catch {
      continue;
    }
  }
  if (!url) throw new Error('❌ No Vite server found on ports 5173-5177');

  // Wait for React root
  await page.waitForSelector('#root', { timeout: 10000 });
  console.log('✅ React root found');

  // Wait for video element (Video.js creates a <video> inside the container)
  const video = page.locator('video');
  await expect(video).toBeVisible({ timeout: 10000 });
  console.log('✅ Video element visible');

  // Wait for canplaythrough
  const ready = await page.evaluate(() => {
    const v = document.querySelector('video');
    if (!v) return false;
    return new Promise((resolve) => {
      if (v.readyState >= 3) resolve(true);
      v.addEventListener('canplaythrough', () => resolve(true), { once: true });
      setTimeout(() => resolve(false), 15000);
    });
  }, { timeout: 20000 });

  expect(ready).toBe(true);

  const duration = await page.evaluate(() => {
    const v = document.querySelector('video');
    return v ? v.duration : 0;
  });
  expect(duration).toBeGreaterThan(0);

  console.log('✅ Video loaded! Duration:', duration, 'seconds');
});
