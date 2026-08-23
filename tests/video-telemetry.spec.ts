import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test('video loads from local file', async ({ page, context }) => {
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

  console.log('🌐 Navigating to', url);

  // Capture console logs
  const consoleLogs: string[] = [];
  page.on('console', (msg) => {
    const text = `[${msg.type()}] ${msg.text()}`;
    consoleLogs.push(text);
    console.log('  ' + text);
  });

  // Capture network requests and responses
  const networkLogs: string[] = [];
  page.on('request', (req) => networkLogs.push(`REQ: ${req.method()} ${req.url()}`));
  page.on('response', (res) => {
    networkLogs.push(`RES: ${res.status()} ${res.url()}`);
  });

  // Navigate
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log('✅ Page loaded');

  // Wait for React
  await page.waitForTimeout(2000);

  // Check React root
  const rootExists = await page.evaluate(() => !!document.getElementById('root'));
  console.log('📦 React root exists:', rootExists);

  // Check video element
  const videoExists = await page.evaluate(() => !!document.querySelector('video'));
  console.log('🎬 Video element exists:', videoExists);

  if (!videoExists) {
    const html = await page.content();
    fs.writeFileSync('page-dump.html', html);
    throw new Error('Video element not found');
  }

  // Get video state
  const videoState = await page.evaluate(() => {
    const v = document.querySelector('video');
    if (!v) return null;
    return {
      readyState: v.readyState,
      networkState: v.networkState,
      error: v.error ? { code: v.error.code, message: v.error.message } : null,
      src: v.src,
      currentSrc: v.currentSrc,
      duration: v.duration,
      videoWidth: v.videoWidth,
      videoHeight: v.videoHeight,
      buffered: v.buffered.length > 0 ? v.buffered.end(0) : 0,
      played: v.played.length > 0 ? v.played.end(0) : 0,
    };
  });

  console.log('=== VIDEO STATE ===');
  console.log('readyState:', videoState?.readyState);
  console.log('networkState:', videoState?.networkState);
  console.log('error:', videoState?.error);
  console.log('src:', videoState?.src);
  console.log('currentSrc:', videoState?.currentSrc);
  console.log('duration:', videoState?.duration);
  console.log('videoWidth:', videoState?.videoWidth);
  console.log('videoHeight:', videoState?.videoHeight);
  console.log('buffered:', videoState?.buffered);
  console.log('played:', videoState?.played);

  if (videoState?.error) {
    const codes: Record<number, string> = {
      1: 'MEDIA_ERR_ABORTED',
      2: 'MEDIA_ERR_NETWORK',
      3: 'MEDIA_ERR_DECODE',
      4: 'MEDIA_ERR_SRC_NOT_SUPPORTED',
    };
    throw new Error(`Video error: ${codes[videoState.error.code] || 'unknown'} – ${videoState.error.message}`);
  }

  // Wait for canplaythrough
  const ready = await page.evaluate(() => {
    const v = document.querySelector('video');
    if (!v) return false;
    return new Promise((resolve) => {
      if (v.readyState >= 3) resolve(true);
      v.addEventListener('canplaythrough', () => resolve(true), { once: true });
      setTimeout(() => resolve(false), 20000);
    });
  }, { timeout: 25000 });

  expect(ready).toBe(true);

  const duration = await page.evaluate(() => {
    const v = document.querySelector('video');
    return v ? v.duration : 0;
  });
  expect(duration).toBeGreaterThan(0);

  console.log('✅ Video loaded! Duration:', duration, 'seconds');

  // Check if video is actually rendering
  const hasVideo = await page.evaluate(() => {
    const v = document.querySelector('video');
    return v ? v.videoWidth > 0 && v.videoHeight > 0 : false;
  });
  console.log('🖼️ Video has visible dimensions:', hasVideo);
  expect(hasVideo).toBe(true);

  console.log('=== FULL CONSOLE LOG ===');
  consoleLogs.forEach(line => console.log(line));

  console.log('=== NETWORK LOG ===');
  networkLogs.forEach(line => console.log(line));

  // Check the video file on disk
  const videoPath = path.join(process.cwd(), 'public', 'video.mp4');
  if (fs.existsSync(videoPath)) {
    const stats = fs.statSync(videoPath);
    console.log('📁 Video file size on disk:', stats.size, 'bytes');
  } else {
    console.log('📁 Video file not found on disk');
  }
});
