import { test, expect } from '@playwright/test';
import fs from 'fs';

test('capture uncaught exception', async ({ page }) => {
  // Auto-detect port
  let url = '';
  for (const port of [5173, 5174, 5175, 5176, 5177, 5178, 5179, 5180]) {
    try {
      await page.goto(`http://localhost:${port}`, { timeout: 2000 });
      url = `http://localhost:${port}`;
      console.log(`✅ Connected to ${url}`);
      break;
    } catch {}
  }
  if (!url) throw new Error('No Vite server found');

  // Capture uncaught exceptions
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    const msg = `[PAGE ERROR] ${error.message}\n${error.stack}`;
    errors.push(msg);
    console.error(msg);
  });

  // Also capture console errors (including React error boundaries)
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[CONSOLE ERROR] ${msg.text()}`);
    }
  });

  // Navigate
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Wait for React to attempt render
  await page.waitForTimeout(3000);

  // Check root content
  const rootContent = await page.evaluate(() => {
    const root = document.getElementById('root');
    return root ? root.innerHTML : 'null';
  });

  console.log('📦 Root content length:', rootContent.length);

  if (rootContent.length === 0) {
    console.log('⚠️ Root is empty – React crashed.');
    if (errors.length === 0) {
      console.log('❌ No pageerror event captured.');
      console.log('   This could mean the error is a silent failure (e.g., import resolution).');
      console.log('   Attempting to evaluate the main module...');
      // Try to see if main.tsx loaded
      const mainLoaded = await page.evaluate(() => {
        // @ts-ignore
        return typeof window.__vite_plugin_react_runtime !== 'undefined';
      });
      console.log('   Vite React plugin runtime present:', mainLoaded);
      // Dump the page HTML
      const html = await page.content();
      fs.writeFileSync('error-page.html', html);
      console.log('📄 Page HTML saved to error-page.html');
    } else {
      console.log(`⚠️ Captured ${errors.length} pageerror(s):`);
      errors.forEach(e => console.log(e));
    }
    throw new Error('React app failed to render (empty root)');
  }

  console.log('✅ App rendered successfully');
});
