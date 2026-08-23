import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  use: {
    channel: 'chrome',  // Use real Chrome with H.264 support
    headless: true,     // Keep headless for CI
    viewport: { width: 1280, height: 720 },
    launchOptions: {
      args: ['--autoplay-policy=no-user-gesture-required'],
    },
  },
});
