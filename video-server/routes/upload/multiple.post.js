import { Route } from 'owebjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Video from '../../models/Video.js';
import { extractThumbnail, getDuration, getVideoInfo, create720pVersion } from '../../utils/ffmpeg.js';
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
    return new Promise((resolve) => {
      upload.array('videos', 10)(req, reply, async (err) => {
        if (err) {
          reply.status(400).send({ error: err.message });
          return resolve();
        }
        
        try {
          // Extract user information from headers
          const userId = req.headers['x-user-id'];
          const username = req.headers['x-user-username'];

          if (!userId) {
            reply.status(401).send({ error: 'Authentication required' });
            return resolve();
          }

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

              console.log(`Processing: ${file.originalname}`);

              const videoInfo = await getVideoInfo(videoPath);
              const videoHeight = videoInfo.height;
              const videoWidth = videoInfo.width;
              
              console.log(`Resolution: ${videoWidth}x${videoHeight}`);

              const videoVersions = [];
              
              const originalResolution = `${videoHeight}p`;
              videoVersions.push({
                filename: videoPath,
                resolution: originalResolution,
                height: videoHeight,
                width: videoWidth,
                size: file.size,
                isOriginal: true
              });

              let path720p = null;
              if (videoHeight > 720) {
                const filename720p = `720p-${file.filename}`;
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
                    console.log(`720p created: ${result720p.actualSizeMB.toFixed(2)} MB`);
                  }
                } catch (error720p) {
                  console.warn('720p creation failed:', error720p.message);
                  if (fs.existsSync(path720p)) {
                    fs.unlinkSync(path720p);
                  }
                }
              }

              const thumbFilename = `${path.parse(file.filename).name}.jpg`;
              const thumbPath = path.join(thumbDir, thumbFilename);

              let duration = 0;

              try {
                await extractThumbnail(videoPath, thumbPath);
                duration = await getDuration(videoPath);
              } catch (ffmpegError) {
                console.warn('FFmpeg error:', ffmpegError.message);
              }

              console.log(`Uploading ${videoVersions.length} version(s) to B2...`);
              const b2Results = await uploadAllResolutionsToB2(
                videoVersions,
                fs.existsSync(thumbPath) ? thumbPath : null
              );

              const video = new Video({
                title: file.originalname,
                description: '',
                resolutions: b2Results.resolutions.map(res => ({
                  resolution: res.resolution,
                  url: res.fileUrl,
                  size: res.size,
                  width: res.width,
                  height: res.height,
                  b2FileId: res.fileId
                })),
                mimeType: file.mimetype,
                thumbnail: b2Results.thumbnail?.fileUrl || null,
                duration: Math.floor(duration),
                categories: categories ? JSON.parse(categories) : [],
                tags: tags ? JSON.parse(tags) : [],
                uploader: userId,
              });

              await video.save();

              uploadedVideos.push({
                id: video._id,
                title: video.title,
                thumbnail: video.thumbnail,
                resolutionsCount: videoVersions.length
              });

              console.log(`Saved: ${video.title} (${videoVersions.length} resolution(s)) by ${username}`);

            } catch (error) {
              console.error(` Failed: ${file.originalname}`, error.message);
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

