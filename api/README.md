# API Documentation

## Ortam Değişkenleri

`.env` dosyası oluşturun:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/video_api
NODE_ENV=development
```

## API Endpoints

### Videos

- `GET /api/videos` - Tüm videoları listele (pagination, search, filter)
- `GET /api/videos/:id` - Tek video detayı
- `PUT /api/videos/:id` - Video güncelle
- `DELETE /api/videos/:id` - Video sil
- `POST /api/videos/:id/view` - İzlenme sayısını artır

### Upload

- `POST /api/upload` - Video yükle (multipart/form-data)

### Categories

- `GET /api/categories` - Tüm kategoriler
- `GET /api/categories/:id` - Tek kategori
- `POST /api/categories` - Kategori oluştur
- `PUT /api/categories/:id` - Kategori güncelle
- `DELETE /api/categories/:id` - Kategori sil

### Tags

- `GET /api/tags` - Tüm tag'ler
- `GET /api/tags/:id` - Tek tag
- `POST /api/tags` - Tag oluştur
- `PUT /api/tags/:id` - Tag güncelle
- `DELETE /api/tags/:id` - Tag sil

### Health

- `GET /api/health` - Sunucu durumu

## Gereksinimler

- Node.js >= 14 (ES6 modül desteği için >= 14.x)
- MongoDB

## Teknik Detaylar

- **Modül Sistemi**: ES6 (import/export)
- **JavaScript Version**: ES2015+
- **FFmpeg**: @ffmpeg-installer/ffmpeg (dahili)
