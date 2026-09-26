const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('file:///home/jules/test_bg.html');
    await page.waitForTimeout(5000);
    await page.screenshot({ path: '/home/jules/verification/screenshots/test_bg2.png' });
    await browser.close();
})();
