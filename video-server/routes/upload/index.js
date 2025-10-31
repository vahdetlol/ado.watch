import { Route } from 'owebjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Video from '../../models/Video.js';
import { extractThumbnail, getDuration, processVideo, create720pVersion } from '../../utils/ffmpeg.js';
import { authenticate } from '../../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Uploads folder in the main project directory
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

// POST /api/upload - Upload video (Authenticated users)
export default class extends Route {
  async handle(req, reply) {
    // Check authentication first
    await authenticate(req, reply);
    if (reply.sent) return;
    
    // Then handle file upload
    return new Promise((resolve) => {
      upload.single('video')(req, reply, async (err) => {
        if (err) {
          reply.status(400).send({ error: err.message });
          return resolve();
        }
        
        try {
          if (!req.file) {
            reply.status(400).send({ error: 'No video file uploaded' });
            return resolve();
          }

          const { title, description, categories, tags } = req.body;
          const videoPath = req.file.path;

          console.log(`Video uploaded: ${req.file.originalname}`);

          // Process video: compress to 512MB and scale to 1080p if needed
          const processedFilename = `processed-${req.file.filename}`;
          const processedPath = path.join(videoDir, processedFilename);
          
          // Create 720p version filename
          const filename720p = `720p-${req.file.filename}`;
          const path720p = path.join(videoDir, filename720p);
          
          let finalVideoPath = videoPath;
          let finalSize = req.file.size;
          let final720pPath = null;
          let final720pSize = null;

          try {
            console.log('Starting video processing...');
            const processResult = await processVideo(videoPath, processedPath, 512);
            
            // Delete original file and use processed one
            fs.unlinkSync(videoPath);
            finalVideoPath = processedPath;
            finalSize = processResult.size;
            
            console.log(`Video processed: ${processResult.actualSizeMB.toFixed(2)} MB`);
          } catch (processError) {
            console.warn('Video processing failed, using original:', processError.message);
            // If processing fails, keep original file
            if (fs.existsSync(processedPath)) {
              fs.unlinkSync(processedPath);
            }
          }

          // Create 720p version
          try {
            console.log('Creating 720p version...');
            const result720p = await create720pVersion(finalVideoPath, path720p);
            final720pPath = result720p.outputPath;
            final720pSize = result720p.size;
            console.log(`720p version created: ${result720p.actualSizeMB.toFixed(2)} MB`);
          } catch (error720p) {
            console.warn('720p creation failed:', error720p.message);
            if (fs.existsSync(path720p)) {
              fs.unlinkSync(path720p);
            }
          }

          const thumbFilename = `${path.parse(req.file.filename).name}.jpg`;
          const thumbPath = path.join(thumbDir, thumbFilename);

          let thumbnailUrl = null;
          let duration = 0;

          try {
            await extractThumbnail(finalVideoPath, thumbPath);
            thumbnailUrl = `/uploads/thumbnails/${thumbFilename}`;
            console.log(`Thumbnail created: ${thumbFilename}`);

            duration = await getDuration(finalVideoPath);
            console.log(`Duration: ${duration}s`);
          } catch (ffmpegError) {
            console.warn('FFmpeg error:', ffmpegError.message);
          }

          const video = new Video({
            title: title || req.file.originalname,
            description: description || '',
            filename: finalVideoPath,
            filename720p: final720pPath,
            mimeType: req.file.mimetype,
            size: finalSize,
            size720p: final720pSize,
            thumbnail: thumbnailUrl,
            duration: Math.floor(duration),
            categories: categories ? JSON.parse(categories) : [],
            tags: tags ? JSON.parse(tags) : [],
            uploader: req.user._id
          });

          await video.save();

          console.log(`✅ Video saved to DB: ${video.title}`);

          reply.status(201).send({
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
          resolve();

        } catch (error) {
          console.error('Upload error:', error);

          if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }

          reply.status(500).send({
            error: 'Video upload failed',
            message: error.message
          });
          resolve();
        }
      });
    });
  }
}
