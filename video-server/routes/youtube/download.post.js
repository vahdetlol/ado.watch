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
import { processVideo, create720pVersion } from '../../utils/ffmpeg.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { uploadMultipleVersionsToB2 } from '../../utils/backblaze.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Uploads folder in the main project directory
const videoDir = path.join(__dirname, '..', '..', 'uploads', 'videos');
const thumbDir = path.join(__dirname, '..', '..', 'uploads', 'thumbnails');

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

    await authorize('admin', 'moderator', 'uploader')(req, reply);
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

      const fileBaseName = path.parse(path.basename(downloadResult.filename)).name;
      const fileExt = path.parse(path.basename(downloadResult.filename)).ext;
      
      let finalVideoPath = downloadResult.filename;
      let finalSize = downloadResult.size;
      let final720pPath = null;
      let final720pSize = null;
      let videoHeight = null;

      try {
        console.log('Processing YouTube video...');
        
        // First, get original video info to determine resolution
        const { getVideoInfo } = await import('../../utils/ffmpeg.js');
        const videoInfo = await getVideoInfo(downloadResult.filename);
        videoHeight = videoInfo.height;
        
        // Process downloaded video: compress to 512MB and scale to 1080p if needed
        const processedFilename = `${fileBaseName}-${videoHeight}p${fileExt}`;
        const processedPath = path.join(videoDir, processedFilename);
        
        const processResult = await processVideo(downloadResult.filename, processedPath, 512);
        
        // Use the actual height from processing result
        videoHeight = processResult.height;
        
        // Rename file with correct resolution if needed
        const correctFilename = `${fileBaseName}-${videoHeight}p${fileExt}`;
        const correctPath = path.join(videoDir, correctFilename);
        
        if (processedPath !== correctPath && fs.existsSync(processedPath)) {
          fs.renameSync(processedPath, correctPath);
          finalVideoPath = correctPath;
        } else {
          finalVideoPath = processResult.outputPath;
        }
        
        // Delete original if different from final
        if (fs.existsSync(downloadResult.filename) && downloadResult.filename !== finalVideoPath) {
          fs.unlinkSync(downloadResult.filename);
        }
        
        finalSize = processResult.size;
        
        console.log(`Video processed: ${processResult.actualSizeMB.toFixed(2)} MB at ${videoHeight}p`);
      } catch (processError) {
        console.warn('Video processing failed, using original:', processError.message);
        // Keep original file
        finalVideoPath = downloadResult.filename;
      }

      // Create 720p version only if original is higher than 720p
      if (videoHeight && videoHeight > 720) {
        try {
          const filename720p = `${fileBaseName}-720p${fileExt}`;
          const path720p = path.join(videoDir, filename720p);
          
          console.log('Creating 720p version...');
          const result720p = await create720pVersion(finalVideoPath, path720p);
          final720pPath = result720p.outputPath;
          final720pSize = result720p.size;
          console.log(`720p version created: ${result720p.actualSizeMB.toFixed(2)} MB`);
        } catch (error720p) {
          console.warn('720p creation failed:', error720p.message);
        }
      }

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

      // Upload to Backblaze B2
      console.log('Uploading to Backblaze B2...');
      const b2Results = await uploadMultipleVersionsToB2(
        finalVideoPath,
        final720pPath,
        fs.existsSync(thumbPath) ? thumbPath : null
      );

      const video = new Video({
        title: title || downloadResult.title,
        description: description || downloadResult.description || '',
        url1: b2Results.video?.fileUrl || null,
        url2: b2Results.video720p?.fileUrl || null,
        mimeType: downloadResult.mimeType,
        size1: finalSize,
        size2: final720pSize,
        thumbnail: b2Results.thumbnail?.fileUrl || null,
        duration: Math.floor(downloadResult.duration || 0),
        categories: categories || [],
        tags: tags || [],
        uploader: req.user._id,
        // Store B2 file IDs for future reference
        b2FileId: b2Results.video?.fileId,
        b2FileId720p: b2Results.video720p?.fileId,
        b2ThumbnailId: b2Results.thumbnail?.fileId,
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
