import { Route } from 'owebjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Video from '../../models/Video.js';
import { extractThumbnail, getDuration, getVideoInfo, create720pVersion } from '../../utils/ffmpeg.js';
import { authenticate } from '../../middleware/auth.js';
import { uploadAllResolutionsToB2 } from '../../utils/backblaze.js';

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

export default class extends Route {
  async handle(req, reply) {
    await authenticate(req, reply);
    if (reply.sent) return;
    
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

          const videoInfo = await getVideoInfo(videoPath);
          const videoHeight = videoInfo.height;
          const videoWidth = videoInfo.width;
          
          console.log(`Original video resolution: ${videoWidth}x${videoHeight}`);
          const videoVersions = [];
          const originalResolution = `${videoHeight}p`;
          videoVersions.push({
            filename: videoPath,
            resolution: originalResolution,
            height: videoHeight,
            width: videoWidth,
            size: req.file.size,
            isOriginal: true
          });

          let path720p = null;
          if (videoHeight > 720) {
            const filename720p = `720p-${req.file.filename}`;
            path720p = path.join(videoDir, filename720p);
            
            try {
              console.log('Creating 720p version...');
              const result720p = await create720pVersion(videoPath, path720p);
              
              if (result720p.size > 0) {
                videoVersions.push({
                  filename: path720p,
                  resolution: '720p',
                  height: 720,
                  width: Math.round((videoWidth * 720) / videoHeight),
                  size: result720p.size,
                  isOriginal: false
                });
                console.log(`720p version created: ${result720p.actualSizeMB.toFixed(2)} MB`);
              }
            } catch (error720p) {
              console.warn('720p creation failed:', error720p.message);
              if (fs.existsSync(path720p)) {
                fs.unlinkSync(path720p);
              }
            }
          } else {
            console.log('Video is 720p or lower, skipping 720p creation');
          }

          const thumbFilename = `${path.parse(req.file.filename).name}.jpg`;
          const thumbPath = path.join(thumbDir, thumbFilename);

          let duration = 0;

          try {
            await extractThumbnail(videoPath, thumbPath);
            console.log(`Thumbnail created: ${thumbFilename}`);

            duration = await getDuration(videoPath);
            console.log(`Duration: ${duration}s`);
          } catch (ffmpegError) {
            console.warn('FFmpeg error:', ffmpegError.message);
          }

          console.log(`Uploading ${videoVersions.length} version(s) to Backblaze B2...`);
          const b2Results = await uploadAllResolutionsToB2(
            videoVersions,
            fs.existsSync(thumbPath) ? thumbPath : null
          );

          const video = new Video({
            title: title || req.file.originalname,
            description: description || '',
            resolutions: b2Results.resolutions.map(res => ({
              resolution: res.resolution,
              url: res.fileUrl,
              size: res.size,
              width: res.width,
              height: res.height,
              b2FileId: res.fileId
            })),
            mimeType: req.file.mimetype,
            thumbnail: b2Results.thumbnail?.fileUrl || null,
            duration: Math.floor(duration),
            categories: categories ? JSON.parse(categories) : [],
            tags: tags ? JSON.parse(tags) : [],
            uploader: req.user._id,
          });

          await video.save();

          console.log(`✓ Video saved to DB with ${videoVersions.length} resolution(s): ${video.title}`);

          reply.status(201).send({
            success: true,
            video: {
              id: video._id,
              title: video.title,
              description: video.description,
              thumbnail: video.thumbnail,
              duration: video.duration,
              resolutions: video.resolutions.map(r => ({
                resolution: r.resolution,
                size: r.size
              })),
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
