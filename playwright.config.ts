import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/e2e',workers:1,fullyParallel:false,
  use:{baseURL:'http://localhost:5173',headless:true,screenshot:'only-on-failure',
    trace:'retain-on-failure',...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})},
  webServer:{command:'node scripts/e2e-server.cjs',url:'http://localhost:5173',reuseExistingServer:false,timeout:60000},
  reporter:[['list'],['html',{open:'never'}]],
});
