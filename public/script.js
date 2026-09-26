const socket = io();

// UI Elements
const logArea = document.getElementById('log-area');
const fallbackInputGroup = document.getElementById('fallback-input-group');
const targetUrlInput = document.getElementById('target-url');
const btnStart = document.getElementById('btn-start');
const btnExecute = document.getElementById('btn-execute');

let isFirstTry = true;
let currentInteractiveUrl = null;
const SUFFIX = "movie-hindi/cars/";

// Helper for logging
function log(msg, type = 'info') {
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

    socket.emit('start_interactive', { url });
});

// Capture real-time status steps
socket.on('status', (data) => {
    log(`Step ${data.step}: ${data.message}`, 'info');
});

socket.on('interactive_ready', (data) => {
    log(data.message, 'success');

    if (data.fullUrl) {
        currentInteractiveUrl = data.fullUrl;
        btnExecute.textContent = 'Redirect Now';
    }

    btnExecute.classList.remove('hidden');
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

    if (currentInteractiveUrl) {
        log(`Redirecting to ${currentInteractiveUrl} in current tab...`, 'info');
        socket.emit('execute_interactive'); // Tell server we're done so it cleans up
        window.location.href = currentInteractiveUrl; // Redirect current tab
    } else {
        socket.emit('execute_interactive');
    }
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
