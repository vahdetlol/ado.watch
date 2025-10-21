const API_URL = 'http://localhost:5000/api';
const VIDEO_SERVER_URL = 'http://localhost:5001/api';

// Check API status
async function checkAPIStatus() {
    const statusBadge = document.getElementById('api-status');
    
    try {
        const response = await fetch(`${API_URL}/health`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (response.ok) {
            statusBadge.textContent = '🟢 Online';
            statusBadge.className = 'status-badge status-online';
        } else {
            throw new Error('API offline');
        }
    } catch (error) {
        statusBadge.textContent = '🔴 Offline';
        statusBadge.className = 'status-badge status-offline';
    }
}

// Check Video Server status
async function checkVideoServerStatus() {
    const statusBadge = document.getElementById('video-status');
    
    try {
        const response = await fetch(`${VIDEO_SERVER_URL}/health`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (response.ok) {
            statusBadge.textContent = '🟢 Online';
            statusBadge.className = 'status-badge status-online';
        } else {
            throw new Error('Video Server offline');
        }
    } catch (error) {
        statusBadge.textContent = '🔴 Offline';
        statusBadge.className = 'status-badge status-offline';
    }
}

// Check status on load
checkAPIStatus();
checkVideoServerStatus();

// Refresh status every 30 seconds
setInterval(() => {
    checkAPIStatus();
    checkVideoServerStatus();
}, 30000);
