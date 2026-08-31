import { defineConfig, devices } from '@playwright/test';
import { webDefaults } from './src/config/defaults';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || webDefaults.webUrl;
const serverTimeout = Number(process.env.PLAYWRIGHT_SERVER_TIMEOUT_MS) || webDefaults.e2eServerTimeoutMs;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const chromiumLaunch = executablePath ? { launchOptions: { executablePath } } : {};

export default defineConfig({
  testDir: './e2e',
  use: { baseURL, trace: 'on-first-retry' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], ...chromiumLaunch } },
    { name: 'mobile', use: { ...devices['iPhone 13'], browserName: 'chromium', ...chromiumLaunch } },
  ],
  webServer: { command: 'npm run dev', url: baseURL, reuseExistingServer: true, timeout: serverTimeout },
});
