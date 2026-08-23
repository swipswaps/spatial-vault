import { test, expect } from '@playwright/test';
import fs from 'fs';

test('capture React error', async ({ page }) => {
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

  // Capture console logs
  const logs: string[] = [];
  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`;
    logs.push(text);
    console.log(text);
  });

  // Navigate with generous timeout
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Wait for React to render (or fail)
  await page.waitForTimeout(3000);

  // Check if root has content
  const rootContent = await page.evaluate(() => {
    const root = document.getElementById('root');
    return root ? root.innerHTML : 'null';
  });

  console.log('📦 Root content length:', rootContent.length);
  if (rootContent.length < 50) {
    console.log('⚠️ Root is empty – React likely crashed');
    // Save the full page HTML for debugging
    const html = await page.content();
    fs.writeFileSync('error-page.html', html);
    console.log('📄 Page HTML saved to error-page.html');
    // Dump all console logs
    console.log('\n=== ALL CONSOLE LOGS ===');
    logs.forEach(l => console.log(l));
    throw new Error('React app failed to render (empty root)');
  }

  // Look for error-boundary rendered error
  const errorVisible = await page.evaluate(() => {
    const el = document.querySelector('[style*="color: #f87171"]');
    return el ? el.textContent : null;
  });
  if (errorVisible) {
    console.log('❌ Error Boundary visible on page:');
    console.log(errorVisible);
    throw new Error('React Error Boundary displayed: ' + errorVisible);
  }

  console.log('✅ App rendered successfully');
});
