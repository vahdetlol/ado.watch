const API_URL = 'http://localhost:5000/api';
let currentPage = 1;
let totalPages = 1;
let searchQuery = '';

// Load videos
async function loadVideos(page = 1) {
    const loading = document.getElementById('loading');
    const container = document.getElementById('video-container');
    
    loading.style.display = 'block';
    container.innerHTML = '';

    try {
        const url = new URL(`${API_URL}/videos`);
        url.searchParams.append('page', page);
        url.searchParams.append('limit', 12);
        if (searchQuery) {
            url.searchParams.append('search', searchQuery);
        }

        const response = await fetch(url);
        const data = await response.json();

        loading.style.display = 'none';

        if (data.videos && data.videos.length > 0) {
            currentPage = parseInt(data.currentPage);
            totalPages = data.totalPages;
            
            const grid = document.createElement('div');
            grid.className = 'video-grid';

            data.videos.forEach(video => {
                const card = createVideoCard(video);
                grid.appendChild(card);
            });

            container.appendChild(grid);

            if (totalPages > 1) {
                container.appendChild(createPagination());
            }
        } else {
            container.innerHTML = `
                <div class="no-videos">
                    <div class="no-videos-icon">📭</div>
                    <h3>Henüz video yok</h3>
                    <p>Video yükleyerek başlayın!</p>
                </div>
            `;
        }
    } catch (error) {
        loading.style.display = 'none';
        container.innerHTML = `
            <div class="no-videos">
                <div class="no-videos-icon">❌</div>
                <h3>Hata oluştu</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

// Create video card
function createVideoCard(video) {
    const card = document.createElement('div');
    card.className = 'video-card';

    const duration = formatDuration(video.duration || 0);
    const size = formatSize(video.size || 0);
    const views = video.views || 0;

    card.innerHTML = `
        <img src="${API_URL.replace('/api', '')}${video.thumbnail || '/uploads/thumbnails/default.jpg'}" 
             class="video-thumbnail" 
             alt="${video.title}"
             onerror="this.src='https://via.placeholder.com/300x180?text=No+Thumbnail'">
        <div class="video-info">
            <div class="video-title">${video.title}</div>
            <div class="video-meta">
                <span>⏱️ ${duration}</span>
                <span>💾 ${size}</span>
                <span>👁️ ${views}</span>
            </div>
        </div>
        <div class="video-actions">
            <button class="btn-small btn-play" onclick="playVideo('${video._id}', '${video.title}')">
                ▶️ Oynat
            </button>
            <button class="btn-small btn-delete" onclick="deleteVideo('${video._id}')">
                🗑️ Sil
            </button>
        </div>
    `;

    return card;
}

// Create pagination
function createPagination() {
    const pagination = document.createElement('div');
    pagination.className = 'pagination';

    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn';
    prevBtn.textContent = '← Önceki';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => loadVideos(currentPage - 1);
    pagination.appendChild(prevBtn);

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.onclick = () => loadVideos(i);
        pagination.appendChild(pageBtn);
    }

    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn';
    nextBtn.textContent = 'Sonraki →';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => loadVideos(currentPage + 1);
    pagination.appendChild(nextBtn);

    return pagination;
}

// Play video
function playVideo(videoId, title) {
    const modal = document.getElementById('video-modal');
    const player = document.getElementById('video-player');
    const modalTitle = document.getElementById('modal-title');

    modalTitle.textContent = title;
    
    // Stream URL oluştur
    const streamUrl = `${API_URL}/stream/${videoId}`;
    console.log('🎬 Video oynatılıyor:', streamUrl);
    
    player.src = streamUrl;
    player.load();
    modal.classList.add('active');
    
    // Video yüklendikten sonra oynat
    player.play().catch(err => {
        console.error('Video oynatma hatası:', err);
        alert('Video oynatılamadı. Konsolu kontrol edin.');
    });

    // İzlenme sayısını artır
    fetch(`${API_URL}/videos/${videoId}/view`, { method: 'POST' })
        .catch(err => console.warn('View count update failed:', err));
}

// Close modal
function closeModal() {
    const modal = document.getElementById('video-modal');
    const player = document.getElementById('video-player');
    
    player.pause();
    player.src = '';
    modal.classList.remove('active');
}

window.closeModal = closeModal;

// Delete video
async function deleteVideo(videoId) {
    if (!confirm('Bu videoyu silmek istediğinizden emin misiniz?')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/videos/${videoId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            alert('Video silindi');
            loadVideos(currentPage);
        } else {
            alert('Silme başarısız');
        }
    } catch (error) {
        alert('Hata: ' + error.message);
    }
}

window.deleteVideo = deleteVideo;
window.playVideo = playVideo;

// Format duration
function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// Format size
function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

// Search
document.getElementById('search-input').addEventListener('input', (e) => {
    searchQuery = e.target.value;
    setTimeout(() => {
        if (searchQuery === e.target.value) {
            loadVideos(1);
        }
    }, 500);
});

// Refresh button
document.getElementById('refresh-btn').addEventListener('click', () => {
    searchQuery = '';
    document.getElementById('search-input').value = '';
    loadVideos(1);
});

// Close modal on background click
document.getElementById('video-modal').addEventListener('click', (e) => {
    if (e.target.id === 'video-modal') {
        closeModal();
    }
});

// Video error handler
document.getElementById('video-player').addEventListener('error', (e) => {
    console.error('Video yükleme hatası:', e);
    const player = document.getElementById('video-player');
    console.error('Video src:', player.src);
    console.error('Error code:', player.error ? player.error.code : 'unknown');
    console.error('Error message:', player.error ? player.error.message : 'unknown');
});

// Load videos on page load
loadVideos(1);
