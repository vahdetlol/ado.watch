import { Route } from 'owebjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Video from '../../models/Video.js';
import { extractThumbnail, getDuration } from '../../utils/ffmpeg.js';
import { authenticate } from '../../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const videoDir = path.join(__dirname, '..', '..', '..', 'uploads', 'videos');
const thumbDir = path.join(__dirname, '..', '..', '..', 'uploads', 'thumbnails');

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

// POST /api/upload/multiple - Çoklu video yükleme (Giriş yapmış kullanıcılar)
export default class extends Route {
  async handle(req, reply) {
    // Check authentication first
    await authenticate(req, reply);
    if (reply.sent) return;
    
    // Then handle file upload
    return new Promise((resolve) => {
      upload.array('videos', 10)(req, reply, async (err) => {
        if (err) {
          reply.status(400).send({ error: err.message });
          return resolve();
        }
        
        try {
          if (!req.files || req.files.length === 0) {
            reply.status(400).send({ error: 'No video files uploaded' });
            return resolve();
          }

          const { categories, tags } = req.body;
          const uploadedVideos = [];
          const failedVideos = [];

          for (const file of req.files) {
            try {
              const videoPath = file.path;

              const thumbFilename = `${path.parse(file.filename).name}.jpg`;
              const thumbPath = path.join(thumbDir, thumbFilename);

              let thumbnailUrl = null;
              let duration = 0;

              try {
                await extractThumbnail(videoPath, thumbPath);
                thumbnailUrl = `/uploads/thumbnails/${thumbFilename}`;
                duration = await getDuration(videoPath);
              } catch (ffmpegError) {
                console.warn('⚠️ FFmpeg error:', ffmpegError.message);
              }

              const video = new Video({
                title: file.originalname,
                description: '',
                filename: videoPath,
                mimeType: file.mimetype,
                size: file.size,
                thumbnail: thumbnailUrl,
                duration: Math.floor(duration),
                categories: categories ? JSON.parse(categories) : [],
                tags: tags ? JSON.parse(tags) : []
              });

              await video.save();

              uploadedVideos.push({
                id: video._id,
                title: video.title,
                thumbnail: video.thumbnail
              });

              console.log(`✅ Saved: ${video.title}`);

            } catch (error) {
              console.error(`❌ Failed: ${file.originalname}`, error.message);
              failedVideos.push({
                filename: file.originalname,
                error: error.message
              });

              if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
              }
            }
          }

          reply.status(201).send({
            success: true,
            message: `${uploadedVideos.length} video uploaded successfully`,
            uploadedVideos,
            failedVideos,
            total: req.files.length,
            successful: uploadedVideos.length,
            failed: failedVideos.length
          });
          resolve();

        } catch (error) {
          console.error('Multiple upload error:', error);

          if (req.files) {
            req.files.forEach(file => {
              if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
              }
            });
          }

          reply.status(500).send({
            error: 'Multiple video upload failed',
            message: error.message
          });
          resolve();
        }
      });
    });
  }
}

