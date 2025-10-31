import { Route } from 'owebjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Video from '../../models/Video.js';
import { extractThumbnail, getDuration, processVideo, create720pVersion } from '../../utils/ffmpeg.js';
import { authenticate } from '../../middleware/auth.js';
import { uploadMultipleVersionsToB2 } from '../../utils/backblaze.js';

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

// POST /api/upload/multiple - Multiple video upload (Authenticated users)
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

              // Process video: compress to 512MB and scale to 1080p if needed
              const processedFilename = `processed-${file.filename}`;
              const processedPath = path.join(videoDir, processedFilename);
              
              // Create 720p version filename
              const filename720p = `720p-${file.filename}`;
              const path720p = path.join(videoDir, filename720p);
              
              let finalVideoPath = videoPath;
              let finalSize = file.size;
              let final720pPath = null;
              let final720pSize = null;

              try {
                console.log(`Processing: ${file.originalname}`);
                const processResult = await processVideo(videoPath, processedPath, 512);
                
                // Delete original and use processed
                fs.unlinkSync(videoPath);
                finalVideoPath = processedPath;
                finalSize = processResult.size;
                
                console.log(`Processed: ${processResult.actualSizeMB.toFixed(2)} MB`);
              } catch (processError) {
                console.warn('Processing failed, using original:', processError.message);
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
                console.log(`720p: ${result720p.actualSizeMB.toFixed(2)} MB`);
              } catch (error720p) {
                console.warn('720p creation failed:', error720p.message);
                if (fs.existsSync(path720p)) {
                  fs.unlinkSync(path720p);
                }
              }

              const thumbFilename = `${path.parse(file.filename).name}.jpg`;
              const thumbPath = path.join(thumbDir, thumbFilename);

              let thumbnailUrl = null;
              let duration = 0;

              try {
                await extractThumbnail(finalVideoPath, thumbPath);
                thumbnailUrl = `/uploads/thumbnails/${thumbFilename}`;
                duration = await getDuration(finalVideoPath);
              } catch (ffmpegError) {
                console.warn('FFmpeg error:', ffmpegError.message);
              }

              // Upload to Backblaze B2
              console.log('Uploading to Backblaze B2...');
              const b2Results = await uploadMultipleVersionsToB2(
                finalVideoPath,
                final720pPath,
                fs.existsSync(thumbPath) ? thumbPath : null
              );

              const video = new Video({
                title: file.originalname,
                description: '',
                url1: b2Results.video?.fileUrl || null,
                url2: b2Results.video720p?.fileUrl || null,
                mimeType: file.mimetype,
                size1: finalSize,
                size2: final720pSize,
                thumbnail: b2Results.thumbnail?.fileUrl || null,
                duration: Math.floor(duration),
                categories: categories ? JSON.parse(categories) : [],
                tags: tags ? JSON.parse(tags) : [],
                uploader: req.user._id,
                // Store B2 file IDs for future reference
                b2FileId: b2Results.video?.fileId,
                b2FileId720p: b2Results.video720p?.fileId,
                b2ThumbnailId: b2Results.thumbnail?.fileId,
              });

              await video.save();

              uploadedVideos.push({
                id: video._id,
                title: video.title,
                thumbnail: video.thumbnail
              });

              console.log(`Saved: ${video.title}`);

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

