const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:8081';
const OUT_DIR = path.join(__dirname);

const SCREENS = [
  { name: '01_home', url: '/' },
  { name: '02_tokcha', url: '/tokcha' },
  { name: '03_library', url: '/library' },
  { name: '04_explore', url: '/explore' },
  { name: '05_maqolalar', url: '/maqolalar' },
  { name: '06_reels', url: '/reels' },
  { name: '07_profile', url: '/profile' },
  { name: '08_sozlab', url: '/sozlab' },
  { name: '09_screenplays', url: '/screenplays' },
];

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14 Pro size
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();

  for (const screen of SCREENS) {
    try {
      console.log(`Taking screenshot: ${screen.name} -> ${screen.url}`);
      await page.goto(`${BASE_URL}${screen.url}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: path.join(OUT_DIR, `${screen.name}.png`),
        fullPage: false,
      });
      console.log(`  ✓ Saved ${screen.name}.png`);
    } catch (err) {
      console.log(`  ✗ Failed ${screen.name}: ${err.message}`);
    }
  }

  await browser.close();
  console.log('\nDone! Screenshots saved to:', OUT_DIR);
})();
