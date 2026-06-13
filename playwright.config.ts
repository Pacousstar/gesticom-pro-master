import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 60000,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.CI
    ? {
        command: 'npm run build && node scripts/standalone-launcher.js',
        port: 3001,
        timeout: 120000,
        reuseExistingServer: true,
      }
    : !process.env.E2E_NO_WEBSERVER
      ? {
          command: 'npm run dev',
          port: 3000,
          timeout: 120000,
          reuseExistingServer: true,
        }
      : undefined,
})
