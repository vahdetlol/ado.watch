import { Route } from 'owebjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Video from '../../models/Video.js';
import { extractThumbnail, getDuration } from '../../utils/ffmpeg.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const videoDir = path.join(__dirname, '..', '..', 'uploads', 'videos');
const thumbDir = path.join(__dirname, '..', '..', 'uploads', 'thumbnails');

if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });
if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, videoDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only video files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024, // 5GB max
  }
});

// POST /api/upload - Video yükle
export default class extends Route {
  middleware = [upload.single('video')];

  async handle(req, reply) {
    try {
      if (!req.file) {
        return reply.status(400).send({ error: 'No video file uploaded' });
      }

      const { title, description, categories, tags } = req.body;
      const videoPath = req.file.path;

      console.log(`📤 Video uploaded: ${req.file.originalname}`);

      const thumbFilename = `${path.parse(req.file.filename).name}.jpg`;
      const thumbPath = path.join(thumbDir, thumbFilename);

      let thumbnailUrl = null;
      let duration = 0;

      try {
        await extractThumbnail(videoPath, thumbPath);
        thumbnailUrl = `/uploads/thumbnails/${thumbFilename}`;
        console.log(`✅ Thumbnail created: ${thumbFilename}`);

        duration = await getDuration(videoPath);
        console.log(`⏱️ Duration: ${duration}s`);
      } catch (ffmpegError) {
        console.warn('⚠️ FFmpeg error:', ffmpegError.message);
      }

      const video = new Video({
        title: title || req.file.originalname,
        description: description || '',
        filename: videoPath,
        mimeType: req.file.mimetype,
        size: req.file.size,
        thumbnail: thumbnailUrl,
        duration: Math.floor(duration),
        categories: categories ? JSON.parse(categories) : [],
        tags: tags ? JSON.parse(tags) : []
      });

      await video.save();

      console.log(`✅ Video saved to DB: ${video.title}`);

      return reply.status(201).send({
        success: true,
        video: {
          id: video._id,
          title: video.title,
          description: video.description,
          thumbnail: video.thumbnail,
          duration: video.duration,
          size: video.size,
          mimeType: video.mimeType
        }
      });

    } catch (error) {
      console.error('Upload error:', error);

      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      return reply.status(500).send({
        error: 'Video upload failed',
        message: error.message
      });
    }
  }
}

