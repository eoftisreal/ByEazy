const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('http://localhost:3000');
    // Wait longer to ensure rendering
    await page.waitForTimeout(5000);
    // Take screenshot of entire page
    await page.screenshot({ path: '/home/jules/verification/screenshots/test_bg.png' });
    await browser.close();
})();
