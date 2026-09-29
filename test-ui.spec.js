const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
    // Ensure directories exist
    const screenshotDir = '/home/jules/verification/screenshots';
    const videoDir = '/home/jules/verification/videos';
    fs.mkdirSync(screenshotDir, { recursive: true });
    fs.mkdirSync(videoDir, { recursive: true });

    const browser = await chromium.launch();
    const context = await browser.newContext({
        recordVideo: {
            dir: videoDir,
            size: { width: 1280, height: 720 }
        }
    });
    const page = await context.newPage();

    try {
        await page.goto('http://localhost:3000');

        // Ensure aria-live on processing indicator exists
        const processingIndicator = page.locator('#processing-indicator');
        const ariaLivePolite = await processingIndicator.getAttribute('aria-live');
        if (ariaLivePolite !== 'polite') {
             throw new Error('Missing aria-live="polite" on processing indicator');
        }

        // We can just rely on the fallback input validation test since the server logic makes testing bypass errors a bit flaky.
        // What we need to verify:
        // 1. The inline error appears when submitting an empty custom URL.
        // 2. The aria attributes are correct.
        // We can just trigger the state manually to test UI.

        await page.evaluate(() => {
            // Force first try failed state
            isFirstTry = false;
            document.getElementById('fallback-input-group').classList.remove('hidden');
        });

        // Ensure the error message triggers correctly when empty
        await page.fill('#target-url', '   '); // empty space
        await page.click('#btn-start');

        await expectErrorMessageVisible(page, 'Please enter a fallback URL.');

        const isInvalid = await page.getAttribute('#target-url', 'aria-invalid');
        if (isInvalid !== 'true') {
            throw new Error('Missing aria-invalid="true" on input');
        }

        const uiError = page.locator('#ui-error-message');
        const ariaLiveAssertive = await uiError.getAttribute('aria-live');
        if (ariaLiveAssertive !== 'assertive') {
            throw new Error('Missing aria-live="assertive" on error message');
        }

        await page.screenshot({ path: path.join(screenshotDir, 'ui-error-state.png') });
        console.log('Test completed successfully.');

    } catch (e) {
        console.error('Test failed:', e);
        await page.screenshot({ path: path.join(screenshotDir, 'ui-error-state-failed.png') });
        process.exit(1);
    } finally {
        await context.close();
        await browser.close();
    }

    async function expectErrorMessageVisible(page, partialText) {
        await page.waitForSelector('#ui-error-message:not(.hidden)', { timeout: 5000 });
        const text = await page.innerText('#ui-error-message');
        if (!text.includes(partialText)) {
            throw new Error(`Expected error message containing "${partialText}", but got "${text}"`);
        }
    }
})();
