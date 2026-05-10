const { defineConfig, devices } = require('@playwright/test');

/**
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './tests',
  
  testMatch: /.*\.js/,

  timeout: 90000,

  fullyParallel: true,
  
  forbidOnly: !!process.env.CI,
  
  retries: process.env.CI ? 2 : 1,
  
  workers: process.env.CI ? 1 : undefined,
  
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {

    trace: 'retain-on-failure',
    
    screenshot: 'only-on-failure',
    
    video: 'retain-on-failure',

    headless: true
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

  ],
});