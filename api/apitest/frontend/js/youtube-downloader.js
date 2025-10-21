const API_URL = 'http://localhost:5001/api'; // Video Server

let videoInfo = null;
let categoriesArray = [];
let tagsArray = [];

// DOM Elements
const youtubeUrlInput = document.getElementById('youtube-url');
const fetchInfoBtn = document.getElementById('fetch-info-btn');
const downloadBtn = document.getElementById('download-btn');
const resetBtn = document.getElementById('reset-btn');
const loading = document.getElementById('loading');
const alert = document.getElementById('alert');
const previewSection = document.getElementById('preview-section');
const editForm = document.getElementById('edit-form');

// Tag Management
function setupTagInput(wrapperId, inputId, arrayRef) {
    const wrapper = document.getElementById(wrapperId);
    const input = document.getElementById(inputId);

    wrapper.addEventListener('click', () => input.focus());

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && input.value.trim()) {
            e.preventDefault();
            const value = input.value.trim();
            
            if (wrapperId === 'categories-wrapper') {
                categoriesArray.push(value);
            } else {
                tagsArray.push(value);
            }
            
            addTag(wrapper, input, value, arrayRef);
            input.value = '';
        }

        if (e.key === 'Backspace' && !input.value) {
            const tags = wrapper.querySelectorAll('.tag-item');
            if (tags.length > 0) {
                const lastTag = tags[tags.length - 1];
                const tagValue = lastTag.textContent.replace('×', '').trim();
                
                if (wrapperId === 'categories-wrapper') {
                    categoriesArray = categoriesArray.filter(t => t !== tagValue);
                } else {
                    tagsArray = tagsArray.filter(t => t !== tagValue);
                }
                
                lastTag.remove();
            }
        }
    });
}

function addTag(wrapper, input, value, arrayRef) {
    const tagEl = document.createElement('div');
    tagEl.className = 'tag-item';
    tagEl.innerHTML = `
        ${value}
        <span class="tag-remove" onclick="removeTag(this, '${value}', '${wrapper.id}')">×</span>
    `;
    wrapper.insertBefore(tagEl, input);
}

function removeTag(element, value, wrapperId) {
    if (wrapperId === 'categories-wrapper') {
        categoriesArray = categoriesArray.filter(t => t !== value);
    } else {
        tagsArray = tagsArray.filter(t => t !== value);
    }
    element.parentElement.remove();
}

window.removeTag = removeTag;

// Initialize tag inputs
setupTagInput('categories-wrapper', 'categories-input', 'categories');
setupTagInput('tags-wrapper', 'tags-input', 'tags');

// Show Alert
function showAlert(message, type) {
    alert.textContent = message;
    alert.className = `alert alert-${type} active`;
    setTimeout(() => {
        alert.classList.remove('active');
    }, 5000);
}

// Format duration
function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Format number
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Fetch Video Info
fetchInfoBtn.addEventListener('click', async () => {
    const url = youtubeUrlInput.value.trim();
    const isPlaylist = document.getElementById('is-playlist').checked;

    if (!url) {
        showAlert('Lütfen bir YouTube URL\'i girin', 'error');
        return;
    }

    fetchInfoBtn.disabled = true;
    loading.classList.add('active');
    alert.classList.remove('active');

    try {
        const endpoint = isPlaylist ? '/youtube/playlist/info' : '/youtube/info';
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || data.error || 'Bir hata oluştu');
        }

        if (isPlaylist) {
            // Playlist bilgileri
            const playlist = data.playlist;
            videoInfo = { isPlaylist: true, ...playlist };

            document.getElementById('preview-title').textContent = playlist.title;
            document.getElementById('preview-duration').textContent = `${playlist.videoCount} video`;
            document.getElementById('preview-uploader').textContent = playlist.uploader || 'N/A';
            document.getElementById('preview-views').textContent = 'Playlist';
            
            if (document.getElementById('preview-thumbnail')) {
                document.getElementById('preview-thumbnail').style.display = 'none';
            }

            document.getElementById('title').value = playlist.title;
            document.getElementById('description').value = `Playlist: ${playlist.title} - ${playlist.videoCount} video`;
        } else {
            // Tek video bilgileri
            videoInfo = data.info;

            document.getElementById('preview-title').textContent = videoInfo.title;
            document.getElementById('preview-duration').textContent = formatDuration(videoInfo.duration);
            document.getElementById('preview-uploader').textContent = videoInfo.uploader;
            document.getElementById('preview-views').textContent = formatNumber(videoInfo.viewCount || 0);
            
            if (document.getElementById('preview-thumbnail')) {
                document.getElementById('preview-thumbnail').src = videoInfo.thumbnail;
                document.getElementById('preview-thumbnail').style.display = 'block';
            }

            document.getElementById('title').value = videoInfo.title;
            document.getElementById('description').value = videoInfo.description || '';
        }

        previewSection.classList.add('active');
        editForm.style.display = 'block';
        fetchInfoBtn.style.display = 'none';
        youtubeUrlInput.disabled = true;
        document.getElementById('is-playlist').disabled = true;

        const message = isPlaylist 
            ? `Playlist bilgileri alındı! ${videoInfo.videoCount} video indirilecek. (Bu işlem uzun sürebilir)`
            : 'Video bilgileri başarıyla alındı! İndirme için aşağıdaki formu doldurun.';
        showAlert(message, 'success');

    } catch (error) {
        showAlert(error.message, 'error');
    } finally {
        loading.classList.remove('active');
        fetchInfoBtn.disabled = false;
    }
});

// Download Video
downloadBtn.addEventListener('click', async () => {
    const title = document.getElementById('title').value.trim();
    const description = document.getElementById('description').value.trim();
    const isPlaylist = videoInfo && videoInfo.isPlaylist;

    if (!title && !isPlaylist) {
        showAlert('Lütfen video başlığını girin', 'error');
        return;
    }

    downloadBtn.disabled = true;
    loading.classList.add('active');
    
    const message = isPlaylist 
        ? `Playlist indiriliyor (${videoInfo.videoCount} video)... Bu işlem uzun sürebilir, lütfen bekleyin.`
        : 'Video indiriliyor ve kaydediliyor... Bu işlem birkaç dakika sürebilir.';
    showAlert(message, 'info');

    try {
        const endpoint = isPlaylist ? '/youtube/playlist/download' : '/youtube/download';
        const body = isPlaylist 
            ? {
                url: youtubeUrlInput.value.trim(),
                categories: categoriesArray,
                tags: tagsArray
              }
            : {
                url: youtubeUrlInput.value.trim(),
                title,
                description,
                categories: categoriesArray,
                tags: tagsArray
              };

        const response = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || data.error || 'Bir hata oluştu');
        }

        if (isPlaylist) {
            const successMsg = `✅ ${data.successful} video başarıyla indirildi ve kaydedildi!`;
            const failMsg = data.failed > 0 ? ` ${data.failed} video başarısız oldu.` : '';
            showAlert(successMsg + failMsg, data.failed > 0 ? 'info' : 'success');
        } else {
            showAlert('✅ Video başarıyla indirildi ve kaydedildi!', 'success');
        }
        
        // Reset after 3 seconds
        setTimeout(() => {
            resetForm();
        }, 3000);

    } catch (error) {
        showAlert(error.message, 'error');
        downloadBtn.disabled = false;
    } finally {
        loading.classList.remove('active');
    }
});

// Reset Form
resetBtn.addEventListener('click', resetForm);

function resetForm() {
    youtubeUrlInput.value = '';
    youtubeUrlInput.disabled = false;
    document.getElementById('is-playlist').disabled = false;
    document.getElementById('is-playlist').checked = false;
    document.getElementById('title').value = '';
    document.getElementById('description').value = '';
    
    // Clear tags
    categoriesArray = [];
    tagsArray = [];
    document.querySelectorAll('.tag-item').forEach(tag => tag.remove());
    
    previewSection.classList.remove('active');
    editForm.style.display = 'none';
    fetchInfoBtn.style.display = 'block';
    downloadBtn.disabled = false;
    videoInfo = null;
}

// Enter key on URL input
youtubeUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        fetchInfoBtn.click();
    }
});
