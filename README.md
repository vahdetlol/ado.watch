# Video Server API

A simple video server with RESTful API endpoints.

## API Endpoints

### Videos

#### GET /api/videos

Get all videos

- **Response**: Array of video objects

#### GET /api/videos/:id

Get video by ID

- **Parameters**: `id` - Video ID
- **Response**: Video object

#### POST /api/videos

Upload new video

- **Body**: Form data with video file
- **Response**: Created video object

#### PUT /api/videos/:id

Update video metadata

- **Parameters**: `id` - Video ID
- **Body**: JSON with updated fields
- **Response**: Updated video object

#### DELETE /api/videos/:id

Delete video

- **Parameters**: `id` - Video ID
- **Response**: Success message

### Streaming

#### GET /stream/:id

Stream video content

- **Parameters**: `id` - Video ID
- **Headers**: Supports Range requests for partial content
- **Response**: Video stream

## Response Format

All API responses follow this format:

{
    "success": true,
    "data": {},
    "message": "Operation completed"
}
