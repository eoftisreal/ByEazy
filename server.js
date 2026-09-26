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

            await page.goto(url, { waitUntil: 'domcontentloaded' });

            // Poll for #shortlink element to be available and have a value
            let found = false;
            let attempts = 0;
            const maxAttempts = 60; // Wait up to ~30 seconds (500ms * 60)

            while (attempts < maxAttempts) {
                const isReady = await page.evaluate(() => {
                    const el = document.querySelector('#shortlink');
                    return el && el.value && el.value.trim().length > 0;
                });

                if (isReady) {
                    found = true;
                    break;
                }

                await new Promise(resolve => setTimeout(resolve, 500));
                attempts++;
            }

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

            // Simulate opening new tab, closing, and reloading (since Playwright is headless, we just do it sequentially)
            // Open the extracted URL in the same context to simulate visiting it
            const newPage = await session.browser.newPage();
            await newPage.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(e => console.log('Navigation error/timeout (expected):', e.message));

            // Wait 15ms (as per user script)
            await new Promise(resolve => setTimeout(resolve, 15));

            // Close the "new tab"
            await newPage.close();

            // Reload original page
            await page.reload({ waitUntil: 'domcontentloaded' });

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

                socket.emit('preloaded_success', { message: `[1/3] Launching browser and navigating to ${url}...` });

                const browser = await chromium.launch({ headless: true });
                try {
                    const context = await browser.newContext();
                    const page = await context.newPage();

                    await page.goto(url, { waitUntil: 'domcontentloaded' });

                    socket.emit('preloaded_success', { message: `[2/3] Waiting for #shortlink to populate (timeout in 60s)...` });

                    // Wait for the shortlink element to exist and have a non-empty value, with a 60-second timeout
                    await page.waitForFunction(() => {
                        const el = document.querySelector('#shortlink');
                        return el && el.value && el.value.trim().length > 0;
                    }, { timeout: 60000, polling: 200 });

                    const targetUrl = await page.evaluate(() => document.querySelector('#shortlink').value.trim());

                    socket.emit('preloaded_success', { message: `[3/3] Shortlink found (${targetUrl}). Executing...` });

                    // Simulate opening in new tab
                    const newPage = await context.newPage();
                    await newPage.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(e => console.log('Navigation timeout expected:', e.message));

                    // Wait 15ms
                    await new Promise(resolve => setTimeout(resolve, 15));

                    // Close the tab
                    await newPage.close();

                    // Reload original page
                    await page.reload({ waitUntil: 'domcontentloaded' });

                    socket.emit('preloaded_success', { message: `Animedekho script executed successfully!` });
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
