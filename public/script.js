const socket = io();

// UI Elements
const logArea = document.getElementById('log-area');
const targetUrlInput = document.getElementById('target-url');
const btnStart = document.getElementById('btn-start');
const btnExecute = document.getElementById('btn-execute');
const btnPreloadExample = document.getElementById('btn-preload-example');

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

// --- Interactive Task Flow ---

btnStart.addEventListener('click', () => {
    const url = targetUrlInput.value.trim();
    if (!url) {
        alert('Please enter a URL.');
        return;
    }

    log(`Starting interactive mode for: ${url}`);
    btnStart.disabled = true;
    btnExecute.classList.add('hidden');

    socket.emit('start_interactive', { url });
});

let currentInteractiveUrl = null;

socket.on('interactive_ready', (data) => {
    log(data.message, 'success');

    // If the server gave us the extracted URL, save it
    if (data.fullUrl) {
        currentInteractiveUrl = data.fullUrl;
        btnExecute.textContent = 'Open Link in New Tab';
    }

    // Reveal the execute button
    btnExecute.classList.remove('hidden');
});

socket.on('interactive_error', (data) => {
    log(`Error: ${data.message}`, 'error');
    resetInteractiveUI();
});

btnExecute.addEventListener('click', () => {
    log('Executing action...');
    btnExecute.disabled = true;

    if (currentInteractiveUrl) {
        // Open the URL locally in the user's REAL browser
        log(`Opening ${currentInteractiveUrl} in your browser...`, 'info');
        window.open(currentInteractiveUrl, '_blank');
        currentInteractiveUrl = null;

        // We still tell the server to do its cleanup/reload routine
        socket.emit('execute_interactive');
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


// --- Preloaded Scripts Flow ---
const btnPreloadAnimedekho = document.getElementById('btn-preload-animedekho');
const animedekhoUrlInput = document.getElementById('animedekho-url');

btnPreloadAnimedekho.addEventListener('click', () => {
    const url = animedekhoUrlInput.value.trim();
    if (!url) {
        alert('Please enter a URL for the AnimeDekho script.');
        return;
    }

    log(`Running Animedekho script...`);
    btnPreloadAnimedekho.disabled = true;
    btnPreloadExample.disabled = true;
    socket.emit('run_preloaded', { scriptId: 'animedekho_verify', url });
});

btnPreloadExample.addEventListener('click', () => {
    log(`Running preloaded script 'example_scrape_title'...`);
    btnPreloadExample.disabled = true;
    btnPreloadAnimedekho.disabled = true;
    socket.emit('run_preloaded', { scriptId: 'example_scrape_title' });
});

socket.on('preloaded_success', (data) => {
    log(data.message, 'success');
    // We only want to re-enable buttons if it's the FINAL success message.
    // For Animedekho, final message contains "successfully"
    if (data.message.includes('Successfully ran!') || data.message.includes('successfully!')) {
        btnPreloadExample.disabled = false;
        btnPreloadAnimedekho.disabled = false;
    }
});

socket.on('preloaded_error', (data) => {
    log(`Error: ${data.message}`, 'error');
    btnPreloadExample.disabled = false;
    btnPreloadAnimedekho.disabled = false;
});
