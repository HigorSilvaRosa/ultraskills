// Storyplay evidence config — records video for every scene test.
// Copy/inject via: storyboard_video.py (auto-provisioned) or manually.
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  timeout: 30000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.STORYPLAY_BASE_URL || 'http://localhost:3000',
    video: { mode: 'on', size: { width: 1280, height: 720 } },
    viewport: { width: 1280, height: 720 },
    trace: 'off',
    screenshot: 'off',
  },
  projects: [{ name: 'evidence', use: { browserName: 'chromium' } }],
})
