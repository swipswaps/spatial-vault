import { test, expect } from '@playwright/test';

test('diagnose video loading', async ({ page }) => {
  // Enable console logging
  page.on('console', msg => console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`));

  // Capture network requests for the video
  let videoRequested = false;
  let videoResponse: { status: number; url: string } | null = null;

  page.on('request', req => {
    if (req.url().includes('.mp4') || req.url().includes('mov_bbb')) {
      videoRequested = true;
      console.log(`[NETWORK] Request: ${req.method()} ${req.url()}`);
    }
  });

  page.on('response', res => {
    if (res.url().includes('.mp4') || res.url().includes('mov_bbb')) {
      videoResponse = { status: res.status(), url: res.url() };
      console.log(`[NETWORK] Response: ${res.status()} ${res.url()}`);
    }
  });

  // Navigate to the app
  await page.goto('http://localhost:5173');

  // Wait for the video element
  const video = page.locator('video');
  await expect(video).toBeVisible({ timeout: 10000 });

  // Poll video state every second for 30 seconds
  const startTime = Date.now();
  let lastReadyState = -1;

  while (Date.now() - startTime < 30000) {
    const state = await video.evaluate((v) => ({
      readyState: v.readyState,
      error: v.error ? { code: v.error.code, message: v.error.message } : null,
      networkState: v.networkState,
      src: v.src,
      duration: v.duration,
      paused: v.paused,
      currentSrc: v.currentSrc,
    }));

    if (state.readyState !== lastReadyState) {
      console.log(`[VIDEO] readyState: ${state.readyState}, error: ${state.error?.code || 'none'}, src: ${state.src}`);
      lastReadyState = state.readyState;
    }

    if (state.error) {
      const codes: Record<number, string> = {
        1: 'MEDIA_ERR_ABORTED',
        2: 'MEDIA_ERR_NETWORK',
        3: 'MEDIA_ERR_DECODE',
        4: 'MEDIA_ERR_SRC_NOT_SUPPORTED',
      };
      throw new Error(`Video error: ${codes[state.error.code] || 'unknown'} (code ${state.error.code}) – ${state.error.message}`);
    }

    if (state.readyState >= 3) {
      console.log('✅ Video is ready!');
      break;
    }

    await page.waitForTimeout(1000);
  }

  // Final check
  const finalState = await video.evaluate((v) => ({
    readyState: v.readyState,
    duration: v.duration,
    error: v.error,
  }));

  console.log('=== FINAL STATE ===');
  console.log('readyState:', finalState.readyState);
  console.log('duration:', finalState.duration);
  console.log('error:', finalState.error);

  if (videoResponse) {
    console.log('Network response status:', videoResponse.status);
  } else {
    console.log('No network request for .mp4 was observed.');
  }

  expect(finalState.readyState).toBeGreaterThanOrEqual(3);
  expect(finalState.duration).toBeGreaterThan(0);
});
