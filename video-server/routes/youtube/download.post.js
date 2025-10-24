import { Route } from 'owebjs';
import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Video from '../../models/Video.js';
import { 
  downloadFromYouTube, 
  isYouTubeUrl
} from '../../utils/youtube.js';
import { authenticate, authorize } from '../../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Uploads folder in the main project directory
const videoDir = path.join(__dirname, '..', '..', '..', 'uploads', 'videos');
const thumbDir = path.join(__dirname, '..', '..', '..', 'uploads', 'thumbnails');

if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });
if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });

const downloadThumbnail = (thumbnailUrl, outputPath) => {
  return new Promise((resolve, reject) => {
    const protocol = thumbnailUrl.startsWith('https') ? https : http;
    
    protocol.get(thumbnailUrl, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Thumbnail download failed: ${response.statusCode}`));
        return;
      }

      const fileStream = fs.createWriteStream(outputPath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve(outputPath);
      });

      fileStream.on('error', (err) => {
        fs.unlink(outputPath, () => {});
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
};

// POST /api/youtube/download - Download video from YouTube (Admin or Moderator)
export default class extends Route {
  async handle(req, reply) {
    // Manual middleware execution
    await authenticate(req, reply);
    if (reply.sent) return;
    
    await authorize('admin', 'moderator')(req, reply);
    if (reply.sent) return;
    
    try {
      const { url, title, description, categories, tags } = req.body;

      if (!url) {
        return reply.status(400).send({ error: 'YouTube URL is required' });
      }

      if (!isYouTubeUrl(url)) {
        return reply.status(400).send({ error: 'Invalid YouTube URL' });
      }

      console.log(`Downloading: ${url}`);
      const downloadResult = await downloadFromYouTube(url, videoDir);

      const thumbFilename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
      const thumbPath = path.join(thumbDir, thumbFilename);
      
      try {
        if (downloadResult.thumbnail) {
          await downloadThumbnail(downloadResult.thumbnail, thumbPath);
          console.log(`Thumbnail downloaded: ${thumbFilename}`);
        }
      } catch (thumbError) {
        console.warn('Thumbnail download failed:', thumbError.message);
      }

      const video = new Video({
        title: title || downloadResult.title,
        description: description || downloadResult.description || '',
        filename: downloadResult.filename,
        mimeType: downloadResult.mimeType,
        size: downloadResult.size,
        thumbnail: fs.existsSync(thumbPath) ? `/uploads/thumbnails/${thumbFilename}` : null,
        duration: Math.floor(downloadResult.duration || 0),
        categories: categories || [],
        tags: tags || []
      });

      await video.save();

      
      console.log(`Video saved: ${video.title}`);
      console.log('Youtube video downloaded by ', req.user.username);
      return reply.status(201).send({
        success: true,
        video: {
          id: video._id,
          title: video.title,
          description: video.description,
          thumbnail: video.thumbnail,
          duration: video.duration,
          size: video.size
        }
      });

    } catch (error) {
      console.error('YouTube download error:', error);
      return reply.status(500).send({ 
        error: 'YouTube download failed', 
        message: error.message 
      });
    }
  }
}
