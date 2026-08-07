import { defineConfig, devices } from '@playwright/test';

const remoteUrl = process.env.TEST_URL;

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: remoteUrl ?? 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  webServer: remoteUrl ? undefined : {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
  ],
});
