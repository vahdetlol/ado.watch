# API Documentation

## Environment Variables

Create a `.env` file:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/video_api
NODE_ENV=development
```

## API Endpoints

### Videos

- `GET /videos` - List all videos (pagination, search, filter)
- `GET /videos/:id` - Single video details
- `PUT /videos/:id` - Update video
- `DELETE /videos/:id` - Delete video
- `POST /videos/:id/view` - Increase view count

### Upload

- `POST /upload` - Upload video (multipart/form-data)

### Categories

- `GET /categories` - All categories
- `GET /categories/:id` - Single category
- `POST /categories` - Create category
- `PUT /categories/:id` - Update category
- `DELETE /categories/:id` - Delete category

### Tags

- `GET /tags` - All tags
- `GET /tags/:id` - Single tag
- `POST /tags` - Create tag
- `PUT /tags/:id` - Update tag
- `DELETE /tags/:id` - Delete tag

### Health

- `GET /health` - Server status

## Requirements

- Node.js >= 14 (for ES6 module support >= 14.x)
- MongoDB

## Technical Details

- **Module System**: ES6 (import/export)
- **JavaScript Version**: ES2015+
- **FFmpeg**: @ffmpeg-installer/ffmpeg (internal)
