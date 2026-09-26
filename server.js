const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { chromium } = require('playwright');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Store active browser contexts/pages mapped to socket IDs
const activeSessions = {};

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // --- Interactive Task ---
    socket.on('start_interactive', async (data) => {
        const { url } = data;
        console.log(`Starting interactive task for ${socket.id} at URL: ${url}`);

        try {
            const browser = await chromium.launch({ headless: true });
            const page = await browser.newPage();

            // Store the session
            activeSessions[socket.id] = { browser, page };

            // Add longer timeout and wait for network idle
            await page.goto(url, {
                waitUntil: 'networkidle',
                timeout: 30000
            }).catch(async (err) => {
                console.log(`Navigation warning (non-critical): ${err.message}`);
            });

            // Wait for shortlink with improved polling
            const found = await waitForShortlink(page, socket.id);

            if (found) {
                console.log(`Target found for ${socket.id}`);
                socket.emit('interactive_ready', { message: 'Target element is ready!' });
            } else {
                console.log(`Target not found for ${socket.id} (timeout)`);
                socket.emit('interactive_error', { message: 'Timeout: Could not find target element.' });
                await cleanupSession(socket.id);
            }
        } catch (error) {
            console.error(`Error in start_interactive:`, error);
            socket.emit('interactive_error', { message: error.message });
            await cleanupSession(socket.id);
        }
    });

    socket.on('execute_interactive', async () => {
        console.log(`Executing interactive task for ${socket.id}`);
        const session = activeSessions[socket.id];

        if (!session || !session.page) {
            socket.emit('interactive_error', { message: 'No active session found. Please start over.' });
            return;
        }

        const { page } = session;

        try {
            // Get the shortlink value
            const targetUrl = await page.evaluate(() => {
                const el = document.querySelector('#shortlink');
                return el ? el.value.trim() : null;
            });

            if (!targetUrl) {
                throw new Error('Target URL not found at time of execution.');
            }

            console.log(`Target URL extracted: ${targetUrl}`);

            // Simulate opening new tab, closing, and reloading
            const newPage = await session.browser.newPage();

            try {
                await newPage.goto(targetUrl, {
                    waitUntil: 'domcontentloaded',
                    timeout: 15000
                });
            } catch (e) {
                console.log('Navigation expected timeout:', e.message);
            }

            // Wait 15ms (as per user script)
            await new Promise(resolve => setTimeout(resolve, 15));

            // Close the "new tab"
            await newPage.close();

            // Reload original page with timeout
            await page.reload({
                waitUntil: 'domcontentloaded',
                timeout: 20000
            }).catch(err => {
                console.log('Reload warning:', err.message);
            });

            socket.emit('interactive_success', { message: 'Task executed successfully!' });
        } catch (error) {
            console.error(`Error in execute_interactive:`, error);
            socket.emit('interactive_error', { message: error.message });
        } finally {
            await cleanupSession(socket.id);
        }
    });

    // --- Preloaded Scripts Task ---
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

                socket.emit('preloaded_success', { message: `[1/4] Launching browser and navigating to ${url}...` });

                const browser = await chromium.launch({ headless: true });
                try {
                    const context = await browser.newContext();
                    const page = await context.newPage();

                    // Navigate with networkidle for better stability
                    await page.goto(url, {
                        waitUntil: 'networkidle',
                        timeout: 30000
                    }).catch((err) => {
                        console.log(`Navigation partial load: ${err.message}`);
                    });

                    socket.emit('preloaded_success', { message: `[2/4] Page loaded. Waiting for #shortlink to populate...` });

                    // Use improved shortlink waiting
                    const isReady = await page.evaluate(() => {
                        const el = document.querySelector('#shortlink');
                        return !!(el && el.value && el.value.trim().length > 0);
                    });

                    if (isReady) {
                        const targetUrl = await page.evaluate(() =>
                            document.querySelector('#shortlink').value.trim()
                        );

                        socket.emit('preloaded_success', {
                            message: `[3/4] Shortlink found (${targetUrl}). Executing...`
                        });

                        // Simulate opening in new tab
                        const newPage = await context.newPage();

                        try {
                            await newPage.goto(targetUrl, {
                                waitUntil: 'domcontentloaded',
                                timeout: 15000
                            });
                        } catch (e) {
                            console.log('Navigation expected:', e.message);
                        }

                        // Wait 15ms
                        await new Promise(resolve => setTimeout(resolve, 15));

                        // Close the tab
                        await newPage.close();

                        // Reload original page
                        await page.reload({
                            waitUntil: 'domcontentloaded',
                            timeout: 20000
                        }).catch(err => {
                            console.log('Reload expected:', err.message);
                        });

                        socket.emit('preloaded_success', {
                            message: `[4/4] Animedekho script executed successfully!`
                        });
                    } else {
                        // Fallback: wait with polling if not immediately ready
                        socket.emit('preloaded_success', {
                            message: `[3/4] Waiting for element (polling with 45s timeout)...`
                        });

                        try {
                            await page.waitForFunction(() => {
                                const el = document.querySelector('#shortlink');
                                return el && el.value && el.value.trim().length > 0;
                            }, { timeout: 45000, polling: 300 });

                            const targetUrl = await page.evaluate(() =>
                                document.querySelector('#shortlink').value.trim()
                            );

                            socket.emit('preloaded_success', {
                                message: `[3/4] Shortlink found (${targetUrl}). Executing...`
                            });

                            // Execute the rest of the script
                            const newPage = await context.newPage();

                            try {
                                await newPage.goto(targetUrl, {
                                    waitUntil: 'domcontentloaded',
                                    timeout: 15000
                                });
                            } catch (e) {
                                console.log('Navigation expected:', e.message);
                            }

                            await new Promise(resolve => setTimeout(resolve, 15));
                            await newPage.close();
                            await page.reload({
                                waitUntil: 'domcontentloaded',
                                timeout: 20000
                            }).catch(err => {
                                console.log('Reload expected:', err.message);
                            });

                            socket.emit('preloaded_success', {
                                message: `[4/4] Animedekho script executed successfully!`
                            });
                        } catch (pollError) {
                            throw new Error(`Timeout waiting for shortlink: ${pollError.message}`);
                        }
                    }
                } finally {
                    await browser.close();
                }
            }
            else {
                throw new Error('Unknown script ID');
            }
        } catch (error) {
            console.error(`Error in run_preloaded:`, error);
            socket.emit('preloaded_error', { message: error.message });
        }
    });

    socket.on('disconnect', async () => {
        console.log(`User disconnected: ${socket.id}`);
        await cleanupSession(socket.id);
    });
});

// Helper function to wait for shortlink with improved logic
async function waitForShortlink(page, socketId) {
    try {
        // First check if it's already there
        const exists = await page.evaluate(() => {
            const el = document.querySelector('#shortlink');
            return !!(el && el.value && el.value.trim().length > 0);
        });

        if (exists) return true;

        // If not, wait with polling (max 45 seconds)
        await page.waitForFunction(() => {
            const el = document.querySelector('#shortlink');
            return el && el.value && el.value.trim().length > 0;
        }, { timeout: 45000, polling: 300 });

        return true;
    } catch (error) {
        console.error(`Shortlink wait failed for ${socketId}:`, error.message);
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