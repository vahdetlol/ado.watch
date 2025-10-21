const API_URL = 'http://localhost:5000/api'; // Video Server (stream)
const VIDEOS_API_URL = 'http://localhost:5001/api'; // API Server (video list)

function log(message, type = 'info') {
    const logDiv = document.getElementById('log');
    const time = new Date().toLocaleTimeString();
    const color = type === 'error' ? '#ff0000' : type === 'success' ? '#00aa00' : '#333';
    logDiv.innerHTML += `<div style="color: ${color}">[${time}] ${message}</div>`;
    logDiv.scrollTop = logDiv.scrollHeight;
    console.log(message);
}

async function testAPIConnection() {
    const resultDiv = document.getElementById('api-result');
    resultDiv.innerHTML = '<p>Test ediliyor...</p>';
    log('API bağlantısı test ediliyor...');

    try {
        const response = await fetch(`${API_URL}/health`);
        const data = await response.json();
        
        if (response.ok) {
            resultDiv.innerHTML = '<div class="info">✅ API Çalışıyor!<br>Status: ' + data.status + '</div>';
            log('✅ API bağlantısı başarılı', 'success');
        } else {
            throw new Error('API yanıt vermedi');
        }
    } catch (error) {
        resultDiv.innerHTML = '<div class="error">❌ API Bağlantı Hatası: ' + error.message + '</div>';
        log('❌ API bağlantı hatası: ' + error.message, 'error');
    }
}

async function loadVideoList() {
    const listDiv = document.getElementById('video-list');
    listDiv.innerHTML = '<p>Yükleniyor...</p>';
    log('Video listesi yükleniyor...');

    try {
        const response = await fetch(`${API_URL}/videos`);
        const data = await response.json();
        
        if (data.videos && data.videos.length > 0) {
            let html = '<div class="info"><strong>Bulunan Videolar:</strong><br>';
            data.videos.forEach(video => {
                html += `
                    <div style="margin: 10px 0; padding: 10px; background: white; border-radius: 5px;">
                        <strong>${video.title}</strong><br>
                        ID: ${video._id}<br>
                        Dosya: ${video.filename}<br>
                        Boyut: ${(video.size / 1024 / 1024).toFixed(2)} MB<br>
                        <button onclick="playVideoById('${video._id}', '${video.title}')">▶ Oynat</button>
                    </div>
                `;
            });
            html += '</div>';
            listDiv.innerHTML = html;
            log(`✅ ${data.videos.length} video bulundu`, 'success');
        } else {
            listDiv.innerHTML = '<div class="info">Hiç video bulunamadı</div>';
            log('⚠️ Veritabanında video yok', 'error');
        }
    } catch (error) {
        listDiv.innerHTML = '<div class="error">❌ Hata: ' + error.message + '</div>';
        log('❌ Video listesi yüklenemedi: ' + error.message, 'error');
    }
}

function testStream() {
    const videoId = document.getElementById('video-id').value.trim();
    if (!videoId) {
        alert('Lütfen Video ID girin');
        return;
    }
    playVideoById(videoId, 'Test Video');
}

function playVideoById(videoId, title) {
    const player = document.getElementById('test-player');
    const infoDiv = document.getElementById('stream-info');
    const streamUrl = `${VIDEOS_API_URL}/stream/${videoId}`;
    
    log(`🎬 Video oynatılıyor: ${title} (ID: ${videoId})`);
    log(`📡 Stream URL: ${streamUrl}`);
    
    infoDiv.innerHTML = `
        <div class="info">
            <strong>Video:</strong> ${title}<br>
            <strong>ID:</strong> ${videoId}<br>
            <strong>Stream URL:</strong> ${streamUrl}
        </div>
    `;

    player.src = streamUrl;
    player.load();
    
    player.addEventListener('loadstart', () => {
        log('📥 Video yüklenmeye başladı...');
    });

    player.addEventListener('canplay', () => {
        log('✅ Video oynatılabilir durumda', 'success');
    });

    player.addEventListener('error', (e) => {
        const errorCode = player.error ? player.error.code : 'unknown';
        const errorMessage = player.error ? player.error.message : 'Bilinmeyen hata';
        log(`❌ Video hatası - Code: ${errorCode}, Message: ${errorMessage}`, 'error');
        infoDiv.innerHTML += `<div class="error">❌ Hata: ${errorMessage}</div>`;
    });

    player.play().catch(err => {
        log('❌ Oynatma hatası: ' + err.message, 'error');
    });
}

// Page load
window.onload = () => {
    log('🚀 Test sayfası yüklendi');
    log('📡 Video Server (stream): http://localhost:5001');
    log('📡 API Server (video list): http://localhost:5000');
    testAPIConnection();
};
