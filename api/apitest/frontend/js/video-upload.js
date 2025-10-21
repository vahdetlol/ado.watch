const API_URL = 'http://localhost:5001/api'; // Video Server

let selectedFile = null;
let categoriesArray = [];
let tagsArray = [];

// DOM Elements
const fileUploadArea = document.getElementById('file-upload-area');
const fileInput = document.getElementById('file-input');
const fileInfo = document.getElementById('file-info');
const uploadBtn = document.getElementById('upload-btn');
const loading = document.getElementById('loading');
const alert = document.getElementById('alert');
const progressBar = document.getElementById('progress-bar');
const progressFill = document.getElementById('progress-fill');

// File Upload Events
fileUploadArea.addEventListener('click', () => fileInput.click());

fileUploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileUploadArea.classList.add('dragover');
});

fileUploadArea.addEventListener('dragleave', () => {
    fileUploadArea.classList.remove('dragover');
});

fileUploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    fileUploadArea.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
        handleFileSelect(file);
    } else {
        showAlert('Lütfen geçerli bir video dosyası seçin', 'error');
    }
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleFileSelect(file);
    }
});

function handleFileSelect(file) {
    selectedFile = file;
    document.getElementById('file-name').textContent = file.name;
    document.getElementById('file-size').textContent = `Boyut: ${(file.size / (1024 * 1024)).toFixed(2)} MB`;
    fileInfo.classList.add('active');
    uploadBtn.disabled = false;

    // Auto-fill title if empty
    if (!document.getElementById('title').value) {
        document.getElementById('title').value = file.name.replace(/\.[^/.]+$/, '');
    }
}

// Tag Management
function setupTagInput(wrapperId, inputId) {
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
            
            addTag(wrapper, input, value);
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

function addTag(wrapper, input, value) {
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
setupTagInput('categories-wrapper', 'categories-input');
setupTagInput('tags-wrapper', 'tags-input');

// Show Alert
function showAlert(message, type) {
    alert.textContent = message;
    alert.className = `alert alert-${type} active`;
    setTimeout(() => {
        alert.classList.remove('active');
    }, 5000);
}

// Upload Video
uploadBtn.addEventListener('click', async () => {
    const title = document.getElementById('title').value.trim();
    const description = document.getElementById('description').value.trim();

    if (!selectedFile) {
        showAlert('Lütfen bir video dosyası seçin', 'error');
        return;
    }

    if (!title) {
        showAlert('Lütfen video başlığını girin', 'error');
        return;
    }

    uploadBtn.disabled = true;
    loading.classList.add('active');
    progressBar.classList.add('active');

    const formData = new FormData();
    formData.append('video', selectedFile);
    formData.append('title', title);
    formData.append('description', description);
    formData.append('categories', JSON.stringify(categoriesArray));
    formData.append('tags', JSON.stringify(tagsArray));

    try {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentComplete = Math.round((e.loaded / e.total) * 100);
                progressFill.style.width = percentComplete + '%';
                progressFill.textContent = percentComplete + '%';
            }
        });

        xhr.addEventListener('load', () => {
            loading.classList.remove('active');
            
            if (xhr.status === 201) {
                const data = JSON.parse(xhr.responseText);
                showAlert('✅ Video başarıyla yüklendi!', 'success');
                
                setTimeout(() => {
                    resetForm();
                }, 2000);
            } else {
                const error = JSON.parse(xhr.responseText);
                showAlert(error.error || 'Yükleme başarısız', 'error');
                uploadBtn.disabled = false;
            }
        });

        xhr.addEventListener('error', () => {
            loading.classList.remove('active');
            showAlert('Bağlantı hatası oluştu', 'error');
            uploadBtn.disabled = false;
        });

        xhr.open('POST', `${API_URL}/upload`);
        xhr.send(formData);

    } catch (error) {
        loading.classList.remove('active');
        showAlert(error.message, 'error');
        uploadBtn.disabled = false;
    }
});

// Reset Form
function resetForm() {
    selectedFile = null;
    fileInput.value = '';
    document.getElementById('title').value = '';
    document.getElementById('description').value = '';
    fileInfo.classList.remove('active');
    progressBar.classList.remove('active');
    progressFill.style.width = '0%';
    progressFill.textContent = '0%';
    uploadBtn.disabled = true;
    
    // Clear tags
    categoriesArray = [];
    tagsArray = [];
    document.querySelectorAll('.tag-item').forEach(tag => tag.remove());
}
