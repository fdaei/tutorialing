import { defineConfig, devices } from '@playwright/test';
import { webDefaults } from './src/config/defaults';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || webDefaults.webUrl;
const serverTimeout = Number(process.env.PLAYWRIGHT_SERVER_TIMEOUT_MS) || webDefaults.e2eServerTimeoutMs;

export default defineConfig({
  testDir: './e2e',
  use: { baseURL, trace: 'on-first-retry' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
  ],
  webServer: { command: 'npm run dev', url: baseURL, reuseExistingServer: true, timeout: serverTimeout },
});
