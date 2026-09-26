const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { chromium } = require('playwright');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Diagnostic endpoint
app.get('/diagnose', async (req, res) => {
    const url = req.query.url || 'https://animedekho.app/';

    console.log(`\n========== DIAGNOSTIC SCAN ==========`);
    console.log(`URL: ${url}\n`);

    try {
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();

        // Set longer timeout
        page.setDefaultTimeout(60000);
        page.setDefaultNavigationTimeout(60000);

        // Navigate
        console.log('[1] Navigating to page...');
        try {
            await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
            console.log('[✓] Page loaded\n');
        } catch (e) {
            console.log(`[⚠] Navigation timeout (partial load): ${e.message}\n`);
        }

        // Wait for any JavaScript to execute
        console.log('[2] Waiting for JavaScript execution (5 seconds)...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        console.log('[✓] Done\n');

        // Get page title
        const title = await page.title();
        console.log(`Page Title: ${title}\n`);

        // Get page URL
        const currentUrl = page.url();
        console.log(`Current URL: ${currentUrl}\n`);

        // Search for input elements
        console.log('[3] Searching for INPUT elements with values...\n');
        const inputs = await page.evaluate(() => {
            const allInputs = document.querySelectorAll('input');
            const results = [];
            allInputs.forEach((input, idx) => {
                results.push({
                    index: idx,
                    id: input.id || '(no id)',
                    name: input.name || '(no name)',
                    type: input.type,
                    value: input.value ? input.value.substring(0, 100) : '(empty)',
                    class: input.className,
                    visible: input.offsetHeight > 0 ? 'yes' : 'no (hidden)'
                });
            });
            return results;
        });

        if (inputs.length > 0) {
            console.log(`Found ${inputs.length} INPUT elements:\n`);
            inputs.forEach(inp => {
                console.log(`  [${inp.index}] ID: "${inp.id}"`);
                console.log(`      Name: "${inp.name}"`);
                console.log(`      Type: ${inp.type}`);
                console.log(`      Value: ${inp.value}`);
                console.log(`      Class: ${inp.className}`);
                console.log(`      Visible: ${inp.visible}`);
                console.log('');
            });
        } else {
            console.log('No INPUT elements found\n');
        }

        // Specifically look for #shortlink
        console.log('[4] Specifically searching for #shortlink...\n');
        const shortlinkExists = await page.evaluate(() => {
            const el = document.querySelector('#shortlink');
            if (!el) return null;
            return {
                exists: true,
                value: el.value,
                type: el.tagName,
                visible: el.offsetHeight > 0
            };
        });

        if (shortlinkExists) {
            console.log(`[✓] #shortlink FOUND`);
            console.log(`    Value: ${shortlinkExists.value}`);
            console.log(`    Visible: ${shortlinkExists.visible}\n`);
        } else {
            console.log(`[✗] #shortlink NOT FOUND\n`);
        }

        // Look for any element with "shortlink" in id, name, or class
        console.log('[5] Searching for elements with "shortlink" in attributes...\n');
        const shortlinkLike = await page.evaluate(() => {
            const results = [];
            document.querySelectorAll('*').forEach(el => {
                const id = el.id || '';
                const name = el.name || '';
                const className = el.className || '';

                if (id.toLowerCase().includes('short') ||
                    name.toLowerCase().includes('short') ||
                    className.toLowerCase().includes('short')) {
                    results.push({
                        tag: el.tagName,
                        id: id || '(none)',
                        name: name || '(none)',
                        class: className || '(none)',
                        text: el.textContent ? el.textContent.substring(0, 50) : '(empty)',
                        value: el.value || '(no value)'
                    });
                }
            });
            return results;
        });

        if (shortlinkLike.length > 0) {
            console.log(`Found ${shortlinkLike.length} elements with "shortlink":\n`);
            shortlinkLike.forEach(el => {
                console.log(`  Tag: ${el.tag}`);
                console.log(`  ID: ${el.id}`);
                console.log(`  Name: ${el.name}`);
                console.log(`  Class: ${el.class}`);
                console.log(`  Value: ${el.value}`);
                console.log(`  Text: ${el.text}`);
                console.log('');
            });
        } else {
            console.log('No elements with "shortlink" found\n');
        }

        // Look for textarea elements
        console.log('[6] Searching for TEXTAREA elements...\n');
        const textareas = await page.evaluate(() => {
            const allTextareas = document.querySelectorAll('textarea');
            const results = [];
            allTextareas.forEach((ta, idx) => {
                results.push({
                    index: idx,
                    id: ta.id || '(no id)',
                    name: ta.name || '(no name)',
                    value: ta.value ? ta.value.substring(0, 100) : '(empty)',
                    class: ta.className
                });
            });
            return results;
        });

        if (textareas.length > 0) {
            console.log(`Found ${textareas.length} TEXTAREA elements:\n`);
            textareas.forEach(ta => {
                console.log(`  [${ta.index}] ID: "${ta.id}"`);
                console.log(`      Name: "${ta.name}"`);
                console.log(`      Value: ${ta.value}`);
                console.log('');
            });
        } else {
            console.log('No TEXTAREA elements found\n');
        }

        // Check for iframe (might contain shortlink)
        console.log('[7] Checking for IFRAME elements...\n');
        const iframes = await page.evaluate(() => {
            const allIframes = document.querySelectorAll('iframe');
            return {
                count: allIframes.length,
                iframes: Array.from(allIframes).map((iframe, idx) => ({
                    index: idx,
                    id: iframe.id,
                    src: iframe.src,
                    name: iframe.name
                }))
            };
        });

        if (iframes.count > 0) {
            console.log(`Found ${iframes.count} IFRAME elements:\n`);
            iframes.iframes.forEach(iframe => {
                console.log(`  [${iframe.index}] ID: ${iframe.id}`);
                console.log(`      Src: ${iframe.src}`);
                console.log(`      Name: ${iframe.name}`);
                console.log('');
            });
        } else {
            console.log('No IFRAME elements found\n');
        }

        // Save page HTML to file for inspection
        const html = await page.content();
        fs.writeFileSync('/tmp/page-dump.html', html);
        console.log('[8] Page HTML saved to /tmp/page-dump.html\n');

        await browser.close();

        // Send diagnostic report
        res.json({
            success: true,
            url: currentUrl,
            title: title,
            inputs: inputs,
            shortlinkFound: !!shortlinkExists,
            shortlinkValue: shortlinkExists?.value || null,
            textareas: textareas,
            iframes: iframes,
            shortlinkLike: shortlinkLike
        });

    } catch (error) {
        console.error('Diagnostic error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }

    console.log('========== END SCAN ==========\n');
});

const activeSessions = {};

// Selectors to try (in priority order)
const SELECTORS_TO_TRY = [
    '#shortlink',                    // Original
    'input[id*="short"]',           // Any input with "short" in id
    'input[id*="link"]',            // Any input with "link" in id
    'textarea#shortlink',           // Textarea version
    'input[type="text"]',           // First text input
    'input[name*="short"]',         // Name attribute
    'textarea[name*="short"]',      // Textarea with name
];

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('start_interactive', async (data) => {
        const { url } = data;
        console.log(`Starting interactive task for ${socket.id} at URL: ${url}`);

        try {
            const browser = await chromium.launch({ headless: true });
            const page = await browser.newPage();
            activeSessions[socket.id] = { browser, page };

            console.log(`[${socket.id}] Navigating to ${url}...`);
            await page.goto(url, {
                waitUntil: 'networkidle',
                timeout: 45000
            }).catch(err => {
                console.log(`[${socket.id}] Navigation partial load: ${err.message}`);
            });

            console.log(`[${socket.id}] Waiting for JavaScript execution...`);
            await new Promise(resolve => setTimeout(resolve, 3000));

            console.log(`[${socket.id}] Searching for shortlink element...`);
            const found = await findAndWaitForShortlink(page, socket.id);

            if (found) {
                console.log(`[${socket.id}] Target found!`);
                socket.emit('interactive_ready', { message: 'Target element is ready!' });
            } else {
                console.log(`[${socket.id}] Target not found`);
                socket.emit('interactive_error', { message: 'Could not find target element. Check browser console.' });
                await cleanupSession(socket.id);
            }
        } catch (error) {
            console.error(`[${socket.id}] Error:`, error.message);
            socket.emit('interactive_error', { message: error.message });
            await cleanupSession(socket.id);
        }
    });

    socket.on('execute_interactive', async () => {
        console.log(`Executing interactive task for ${socket.id}`);
        const session = activeSessions[socket.id];

        if (!session || !session.page) {
            socket.emit('interactive_error', { message: 'No active session found.' });
            return;
        }

        const { page } = session;

        try {
            const targetUrl = await page.evaluate(() => {
                // Try to get value from any of our known elements
                for (const selector of ['#shortlink', 'input[type="text"]', 'textarea']) {
                    const el = document.querySelector(selector);
                    if (el && el.value && el.value.trim()) {
                        return el.value.trim();
                    }
                }
                return null;
            });

            if (!targetUrl) {
                throw new Error('Target URL not found.');
            }

            console.log(`[${socket.id}] Extracted URL: ${targetUrl}`);

            const newPage = await session.browser.newPage();
            try {
                await newPage.goto(targetUrl, {
                    waitUntil: 'domcontentloaded',
                    timeout: 15000
                });
            } catch (e) {
                console.log(`[${socket.id}] Navigation expected timeout`);
            }

            await new Promise(resolve => setTimeout(resolve, 100));
            await newPage.close();

            await page.reload({
                waitUntil: 'domcontentloaded',
                timeout: 20000
            }).catch(err => {
                console.log(`[${socket.id}] Reload warning`);
            });

            socket.emit('interactive_success', { message: 'Task executed successfully!' });
        } catch (error) {
            console.error(`[${socket.id}] Error:`, error.message);
            socket.emit('interactive_error', { message: error.message });
        } finally {
            await cleanupSession(socket.id);
        }
    });

    socket.on('run_preloaded', async (data) => {
        const { scriptId, url } = data;
        console.log(`Starting preloaded script '${scriptId}' for ${socket.id}`);

        try {
            if (scriptId === 'example_scrape_title') {
                const browser = await chromium.launch({ headless: true });
                const page = await browser.newPage();
                await page.goto('https://example.com');
                const title = await page.title();
                await browser.close();
                socket.emit('preloaded_success', { message: `Successfully ran! Title was: ${title}` });
            }
            else if (scriptId === 'animedekho_verify') {
                if (!url) throw new Error('URL is required for this script.');

                socket.emit('preloaded_success', { message: `[1/5] Launching browser...` });

                const browser = await chromium.launch({ headless: true });
                try {
                    const context = await browser.newContext();
                    const page = await context.newPage();

                    socket.emit('preloaded_success', { message: `[2/5] Navigating to ${url}...` });

                    await page.goto(url, {
                        waitUntil: 'networkidle',
                        timeout: 45000
                    }).catch(err => {
                        console.log(`[${scriptId}] Partial load: ${err.message}`);
                    });

                    socket.emit('preloaded_success', { message: `[3/5] Waiting for JavaScript execution...` });
                    await new Promise(resolve => setTimeout(resolve, 3000));

                    socket.emit('preloaded_success', { message: `[4/5] Searching for shortlink element...` });

                    const found = await findAndWaitForShortlink(page, scriptId, socket);

                    if (found) {
                        const targetUrl = await page.evaluate(() => {
                            for (const selector of ['#shortlink', 'input[type="text"]', 'textarea']) {
                                const el = document.querySelector(selector);
                                if (el && el.value && el.value.trim()) {
                                    return el.value.trim();
                                }
                            }
                            return null;
                        });

                        if (!targetUrl) {
                            throw new Error('Could not extract URL from element');
                        }

                        console.log(`[${scriptId}] Found URL: ${targetUrl}`);

                        socket.emit('preloaded_success', { message: `[5/5] Executing action...` });

                        const newPage = await context.newPage();
                        try {
                            await newPage.goto(targetUrl, {
                                waitUntil: 'domcontentloaded',
                                timeout: 15000
                            });
                        } catch (e) {
                            console.log(`[${scriptId}] Navigation expected`);
                        }

                        await new Promise(resolve => setTimeout(resolve, 100));
                        await newPage.close();

                        await page.reload({
                            waitUntil: 'domcontentloaded',
                            timeout: 20000
                        }).catch(err => {
                            console.log(`[${scriptId}] Reload expected`);
                        });

                        socket.emit('preloaded_success', { message: `AnimeDekho script executed successfully!` });
                    } else {
                        throw new Error('Could not find shortlink element on page');
                    }
                } finally {
                    await browser.close();
                }
            }
            else {
                throw new Error('Unknown script ID');
            }
        } catch (error) {
            console.error(`[${scriptId}] Error:`, error.message);
            socket.emit('preloaded_error', { message: error.message });
        }
    });

    socket.on('disconnect', async () => {
        console.log(`User disconnected: ${socket.id}`);
        await cleanupSession(socket.id);
    });
});

/**
 * Smart function to find and wait for shortlink element
 * Tries multiple selectors and strategies
 */
async function findAndWaitForShortlink(page, sessionId, socket = null) {
    try {
        // First, try immediate detection with all selectors
        console.log(`[${sessionId}] Trying immediate detection...`);
        for (const selector of SELECTORS_TO_TRY) {
            const found = await page.evaluate((sel) => {
                const el = document.querySelector(sel);
                return !!(el && el.value && el.value.trim().length > 0);
            }, selector);

            if (found) {
                console.log(`[${sessionId}] ✓ Found with selector: ${selector}`);
                if (socket) socket.emit('preloaded_success', { message: `Found element using: ${selector}` });
                return true;
            }
        }

        // If not found immediately, log all available inputs
        const allInputs = await page.evaluate(() => {
            const inputs = [];
            document.querySelectorAll('input, textarea').forEach((el, idx) => {
                inputs.push({
                    tag: el.tagName,
                    id: el.id || '(none)',
                    name: el.name || '(none)',
                    type: el.type || '(none)',
                    hasValue: !!(el.value && el.value.trim()),
                    valuePreview: el.value ? el.value.substring(0, 50) : '(empty)'
                });
            });
            return inputs;
        });

        console.log(`[${sessionId}] Available input elements:`);
        allInputs.forEach((input, idx) => {
            console.log(`  [${idx}] <${input.tag}> id="${input.id}" name="${input.name}" type="${input.type}" value="${input.valuePreview}"`);
        });

        if (socket) {
            socket.emit('preloaded_success', {
                message: `Element not immediately available. Polling for 30 seconds...`
            });
        }

        // Try polling for 30 seconds
        console.log(`[${sessionId}] Polling for element (30 seconds)...`);
        for (let attempt = 0; attempt < 60; attempt++) {
            for (const selector of SELECTORS_TO_TRY) {
                const found = await page.evaluate((sel) => {
                    const el = document.querySelector(sel);
                    return !!(el && el.value && el.value.trim().length > 0);
                }, selector);

                if (found) {
                    const value = await page.evaluate((sel) => {
                        const el = document.querySelector(sel);
                        return el?.value || null;
                    }, selector);

                    console.log(`[${sessionId}] ✓ Found after ${attempt * 500}ms with selector: ${selector}`);
                    console.log(`[${sessionId}] Value preview: ${value?.substring(0, 100)}`);
                    if (socket) socket.emit('preloaded_success', { message: `Found element after ${attempt * 500}ms` });
                    return true;
                }
            }

            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log(`[${sessionId}] ✗ Element not found after 30 seconds`);
        return false;

    } catch (error) {
        console.error(`[${sessionId}] Error in findAndWaitForShortlink:`, error.message);
        return false;
    }
}

async function cleanupSession(socketId) {
    if (activeSessions[socketId]) {
        try {
            await activeSessions[socketId].browser.close();
        } catch (e) {
            console.error('Error closing browser:', e);
        }
        delete activeSessions[socketId];
    }
}

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
