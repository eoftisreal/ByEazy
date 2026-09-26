const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { chromium } = require('playwright');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const activeSessions = {};

/**
 * Launch browser with stealth/anti-detection measures
 */
async function launchBrowserWithStealth() {
    const browser = await chromium.launch({
        headless: true,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-breakpad',
            '--disable-client-side-phishing-detection',
            '--disable-component-extensions-with-background-pages',
            '--disable-default-apps',
            '--disable-device-discovery-notifications',
            '--disable-extensions',
            '--disable-features=TranslateUI,PrivacyPreservingAttributionReportingAPI',
            '--disable-sync',
        ]
    });

    return browser;
}

/**
 * Create page with stealth measures
 */
async function createStealthPage(browser) {
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();

    // Override navigator.webdriver property
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
        });
    });

    // Inject detection bypass
    await page.addInitScript(() => {
        // Hide automation markers
        window.chrome = {
            runtime: {}
        };

        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5]
        });

        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en']
        });
    });

    // Disable popups by intercepting window.open
    await page.addInitScript(() => {
        window.originalOpen = window.open;
        window.open = function(url) {
            console.log('[POPUP INTERCEPTED]', url);
            // Store the URL somewhere accessible
            if (!window.__interceptedPopups) {
                window.__interceptedPopups = [];
            }
            window.__interceptedPopups.push(url);
            return {
                close: () => console.log('[POPUP CLOSED]')
            };
        };
    });

    return { context, page };
}

/**
 * Smart element finder - tries multiple strategies
 */
async function findAndExtractValue(page) {
    const strategies = [
        // Direct selectors
        { selector: '#shortlink', method: 'value' },
        { selector: 'input#shortlink', method: 'value' },
        { selector: 'textarea#shortlink', method: 'value' },

        // By name
        { selector: 'input[name="shortlink"]', method: 'value' },
        { selector: 'textarea[name="shortlink"]', method: 'value' },
        { selector: 'input[name="link"]', method: 'value' },
        { selector: 'input[name="url"]', method: 'value' },

        // By ID variations
        { selector: 'input#link', method: 'value' },
        { selector: 'input#url', method: 'value' },
        { selector: 'input#link-copy', method: 'value' },
        { selector: '#link', method: 'value' },

        // By data attributes
        { selector: 'input[data-id="shortlink"]', method: 'value' },
        { selector: '[data-shortlink]', method: 'dataset.shortlink' },

        // Text content from elements
        { selector: '.shortlink-display, .link-display, [class*="link"]', method: 'text' },
    ];

    for (const strategy of strategies) {
        try {
            const value = await page.evaluate((args) => {
                const el = document.querySelector(args.selector);
                if (!el) return null;

                let val;
                if (args.method === 'value') {
                    val = el.value || el.textContent;
                } else if (args.method === 'text') {
                    val = el.textContent;
                } else if (args.method.startsWith('dataset.')) {
                    const key = args.method.split('.')[1];
                    val = el.dataset[key];
                } else {
                    val = el[args.method];
                }

                // Verify it's a valid URL
                if (val && val.trim()) {
                    try {
                        new URL(val);
                        return val.trim();
                    } catch {
                        return null;
                    }
                }
                return null;
            }, { selector: strategy.selector, method: strategy.method });

            if (value) {
                console.log(`✓ Found value using: ${strategy.selector} (${strategy.method})`);
                return { value, selector: strategy.selector };
            }
        } catch (e) {
            // Try next strategy
        }
    }

    // Last resort: find ANY element with a URL-like value
    try {
        const value = await page.evaluate(() => {
            const allElements = document.querySelectorAll('input, textarea, [data-url], [data-link]');
            for (const el of allElements) {
                const val = el.value || el.textContent || el.dataset.url || el.dataset.link;
                if (val && val.trim() && val.includes('http')) {
                    try {
                        new URL(val);
                        return val.trim();
                    } catch {
                        continue;
                    }
                }
            }
            return null;
        });

        if (value) {
            console.log('✓ Found value via fallback method');
            return { value, selector: 'fallback' };
        }
    } catch (e) {
        console.error('Fallback extraction failed:', e.message);
    }

    return null;
}

/**
 * Wait for element with smart detection
 */
async function waitForValue(page, maxWait = 45000) {
    const startTime = Date.now();
    const pollInterval = 500;

    while (Date.now() - startTime < maxWait) {
        const result = await findAndExtractValue(page);
        if (result) {
            return result;
        }

        // Log page state for debugging
        const state = await page.evaluate(() => {
            return {
                title: document.title,
                url: window.location.href,
                readyState: document.readyState,
                inputCount: document.querySelectorAll('input').length,
                textareaCount: document.querySelectorAll('textarea').length,
                hasShortlink: !!document.querySelector('#shortlink')
            };
        });

        console.log(`[Wait] Elapsed: ${Date.now() - startTime}ms | ${JSON.stringify(state)}`);

        await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Timeout waiting for value after ${maxWait}ms`);
}

io.on('connection', (socket) => {
    console.log(`\n[${socket.id}] Client connected`);

    socket.on('start_interactive', async (data) => {
        const { url } = data;
        console.log(`[${socket.id}] START_INTERACTIVE: ${url}`);

        try {
            const browser = await launchBrowserWithStealth();
            const { context, page } = await createStealthPage(browser);

            activeSessions[socket.id] = { browser, context, page };

            console.log(`[${socket.id}] [1/4] Navigating to ${url}...`);
            socket.emit('status', { step: 1, message: 'Navigating...' });

            await page.goto(url, {
                waitUntil: 'networkidle',
                timeout: 45000
            }).catch(err => {
                console.log(`[${socket.id}] Navigation warning: ${err.message}`);
            });

            console.log(`[${socket.id}] [2/4] Waiting for JavaScript execution...`);
            socket.emit('status', { step: 2, message: 'Waiting for page to load...' });

            await new Promise(resolve => setTimeout(resolve, 5000));

            console.log(`[${socket.id}] [3/4] Searching for value...`);
            socket.emit('status', { step: 3, message: 'Searching for shortlink...' });

            const result = await waitForValue(page, 45000);

            console.log(`[${socket.id}] [4/4] Value found! Ready to execute.`);
            socket.emit('status', { step: 4, message: 'Ready!' });
            socket.emit('interactive_ready', {
                message: 'Target element found!',
                value: result.value.substring(0, 100),
                fullUrl: result.value // Send the full URL to the frontend
            });

        } catch (error) {
            console.error(`[${socket.id}] ERROR in start_interactive:`, error.message);
            socket.emit('interactive_error', { message: error.message });
            await cleanupSession(socket.id);
        }
    });

    socket.on('execute_interactive', async () => {
        console.log(`[${socket.id}] EXECUTE_INTERACTIVE`);
        const session = activeSessions[socket.id];

        if (!session) {
            socket.emit('interactive_error', { message: 'No active session' });
            return;
        }

        try {
            console.log(`[${socket.id}] Extracting URL...`);
            const result = await findAndExtractValue(session.page);

            if (!result) {
                throw new Error('Could not extract URL from element');
            }

            const targetUrl = result.value;
            console.log(`[${socket.id}] Extracted: ${targetUrl.substring(0, 100)}...`);

            console.log(`[${socket.id}] Opening target URL...`);
            const newPage = await session.context.newPage();

            try {
                await newPage.goto(targetUrl, {
                    waitUntil: 'domcontentloaded',
                    timeout: 15000
                });
            } catch (e) {
                console.log(`[${socket.id}] Navigation expected: ${e.message}`);
            }

            await new Promise(resolve => setTimeout(resolve, 200));

            console.log(`[${socket.id}] Closing new page...`);
            await newPage.close();

            console.log(`[${socket.id}] Reloading original page...`);
            await session.page.reload({
                waitUntil: 'networkidle',
                timeout: 20000
            }).catch(err => {
                console.log(`[${socket.id}] Reload warning: ${err.message}`);
            });

            console.log(`[${socket.id}] ✓ SUCCESS`);
            socket.emit('interactive_success', { message: 'Task completed!' });

        } catch (error) {
            console.error(`[${socket.id}] ERROR in execute_interactive:`, error.message);
            socket.emit('interactive_error', { message: error.message });
        } finally {
            await cleanupSession(socket.id);
        }
    });


    socket.on('disconnect', async () => {
        console.log(`[${socket.id}] Client disconnected`);
        await cleanupSession(socket.id);
    });
});

async function cleanupSession(socketId) {
    if (activeSessions[socketId]) {
        try {
            await activeSessions[socketId].browser.close();
            delete activeSessions[socketId];
            console.log(`[${socketId}] Session cleaned up`);
        } catch (e) {
            console.error(`[${socketId}] Cleanup error:`, e.message);
        }
    }
}

// REST API for remote execution
app.post('/api/verify', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL required' });
    }

    console.log(`\n[API] POST /api/verify | ${url}`);

    try {
        const browser = await launchBrowserWithStealth();
        const { context, page } = await createStealthPage(browser);

        try {
            console.log('[API] Navigating...');
            await page.goto(url, {
                waitUntil: 'networkidle',
                timeout: 45000
            }).catch(err => {
                console.log(`[API] Navigation warning: ${err.message}`);
            });

            console.log('[API] Waiting for load...');
            await new Promise(resolve => setTimeout(resolve, 5000));

            console.log('[API] Finding value...');
            const result = await waitForValue(page, 45000);

            console.log('[API] Opening target...');
            const newPage = await context.newPage();

            try {
                await newPage.goto(result.value, {
                    waitUntil: 'domcontentloaded',
                    timeout: 15000
                });
            } catch (e) {
                console.log(`[API] Navigation expected: ${e.message}`);
            }

            await new Promise(resolve => setTimeout(resolve, 200));
            await newPage.close();

            console.log('[API] Reloading...');
            await page.reload({
                waitUntil: 'networkidle',
                timeout: 20000
            }).catch(err => {
                console.log(`[API] Reload warning: ${err.message}`);
            });

            console.log('[API] ✓ SUCCESS');
            res.json({ success: true, message: 'Verification completed' });

        } finally {
            await browser.close();
        }

    } catch (error) {
        console.error('[API] ERROR:', error.message);
        res.status(500).json({ error: error.message });
    }
});

server.listen(PORT, () => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`WebSocket: ws://localhost:${PORT}`);
    console.log(`REST API: POST http://localhost:${PORT}/api/verify`);
    console.log(`${'='.repeat(60)}\n`);
});
