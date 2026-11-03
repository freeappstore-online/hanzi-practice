import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests', fullyParallel: true, workers: 3, timeout: 30000,
  use: {baseURL: process.env.APP_URL || 'http://127.0.0.1:4173', viewport:{width:1280,height:900}, trace:'retain-on-failure'},
  webServer: process.env.APP_URL ? undefined : {command:'pnpm --filter @hanzi-practice/web preview --host 127.0.0.1 --port 4173', url:'http://127.0.0.1:4173', reuseExistingServer:true},
})
