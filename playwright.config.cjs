const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({testDir:'tests',workers:3, fullyParallel:true, timeout:22000, reporter:[['list'],['json',{outputFile:'results.json'}]],
 use:{baseURL:'http://127.0.0.1:8843', launchOptions:{executablePath:process.env.CHROMIUM_PATH || (require('node:fs').existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined)},trace:'retain-on-failure'},
 webServer:{command:'python3 -m http.server 8843 --bind 127.0.0.1',url:'http://127.0.0.1:8843'}});
