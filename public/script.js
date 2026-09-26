const socket = io();

// UI Elements
const logSection = document.getElementById('log-section');
const logArea = document.getElementById('log-area');
const fallbackInputGroup = document.getElementById('fallback-input-group');
const targetUrlInput = document.getElementById('target-url');
const btnStart = document.getElementById('btn-start');
const btnExecute = document.getElementById('btn-execute');
const processingIndicator = document.getElementById('processing-indicator');

let isFirstTry = true;
const SUFFIX = "movie-hindi/cars/";

// Hide log section unless we are on the secret /mario path
if (window.location.pathname !== '/mario') {
    logSection.classList.add('hidden');
}

// Function to toggle processing indicator
function setProcessing(isProcessing) {
    if (isProcessing) {
        btnStart.disabled = true;
        btnStart.setAttribute('aria-busy', 'true');
        // Instead of hiding the button completely and breaking focus, we hide the text via CSS or just show the indicator below it.
        // For simplicity and minimal CSS change, we keep it visible but disabled.
        processingIndicator.classList.remove('hidden');
    } else {
        btnStart.disabled = false;
        btnStart.removeAttribute('aria-busy');
        processingIndicator.classList.add('hidden');
    }
}

// Helper for logging
function log(msg, type = 'info') {
    // We can skip DOM updates if logs are hidden, but for safety we'll just keep writing them to the hidden div
    const div = document.createElement('div');
    div.className = `log-msg ${type}`;
    const time = new Date().toLocaleTimeString();
    div.innerText = `[${time}] ${msg}`;
    logArea.appendChild(div);
    logArea.scrollTop = logArea.scrollHeight;
}

// Socket Connection
socket.on('connect', () => {
    log('Connected to server.', 'success');
});

socket.on('disconnect', () => {
    log('Disconnected from server.', 'error');
    resetInteractiveUI();
});

// --- Bypass Flow ---

btnStart.addEventListener('click', () => {
    let url = 'https://animedekho.app/movie-hindi/cars/';

    // If it's no longer the first try, use the user's input URL + suffix
    if (!isFirstTry) {
        let rawUrl = targetUrlInput.value.trim();
        if (!rawUrl) {
            alert('Please enter a fallback URL.');
            return;
        }

        // Ensure the base URL ends with a slash before appending the suffix
        if (!rawUrl.endsWith('/')) {
            rawUrl += '/';
        }
        url = rawUrl + SUFFIX;
    }

    log(`Starting bypass for: ${url}`);
    btnStart.disabled = true;
    btnExecute.classList.add('hidden');

    setProcessing(true);
    socket.emit('start_interactive', { url });
});

// Capture real-time status steps
socket.on('status', (data) => {
    log(`Step ${data.step}: ${data.message}`, 'info');
});

socket.on('interactive_ready', (data) => {
    log(data.message, 'success');

    if (data.fullUrl) {
        // Basic frontend validation to prevent javascript: XSS
        if (!data.fullUrl.startsWith('http://') && !data.fullUrl.startsWith('https://')) {
            log(`Error: Unsafe URL returned (${data.fullUrl})`, 'error');
            resetInteractiveUI();
            return;
        }

        log(`Redirecting automatically to ${data.fullUrl}...`, 'info');
        // Tell server to clean up the backend session
        socket.emit('execute_interactive');

        // Add a tiny delay to ensure the socket message fires before the page unloads
        setTimeout(() => {
            window.location.href = data.fullUrl;
        }, 100);
    } else {
        // Fallback if URL wasn't provided for some reason
        btnExecute.classList.remove('hidden');
    }
});

socket.on('interactive_error', (data) => {
    log(`Error: ${data.message}`, 'error');

    // If the first try fails, reveal the fallback input box for subsequent tries
    if (isFirstTry) {
        isFirstTry = false;
        log('Default URL failed. Fallback input box revealed.', 'warning');
        fallbackInputGroup.classList.remove('hidden');
    }

    resetInteractiveUI();
});

btnExecute.addEventListener('click', () => {
    log('Redirecting...');
    btnExecute.disabled = true;
    socket.emit('execute_interactive');
});

socket.on('interactive_success', (data) => {
    log(data.message, 'success');
    resetInteractiveUI();
});

function resetInteractiveUI() {
    btnStart.disabled = false;
    btnExecute.disabled = false;
    btnExecute.classList.add('hidden');
}
