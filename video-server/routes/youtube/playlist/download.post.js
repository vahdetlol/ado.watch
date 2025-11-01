import { Route } from 'owebjs';
import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Video from '../../../models/Video.js';
import { 
  downloadPlaylist,
  isPlaylistUrl 
} from '../../../utils/youtube.js';
import { processVideo, create720pVersion } from '../../../utils/ffmpeg.js';
import { authenticate, authorize } from '../../../middleware/auth.js';

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

// POST /api/youtube/playlist/download - Download all videos from a YouTube Playlist (Admin or Moderator)
export default class extends Route {
  async handle(req, reply) {
    // Manual middleware execution
    await authenticate(req, reply);
    if (reply.sent) return;

    await authorize('admin', 'moderator', 'uploader')(req, reply);
    if (reply.sent) return;
    
    try {
      const { url, categories, tags } = req.body;

      if (!url) {
        return reply.status(400).send({ error: 'YouTube Playlist URL is required' });
      }

      if (!isPlaylistUrl(url)) {
        return reply.status(400).send({ error: 'Invalid YouTube Playlist URL' });
      }

      console.log(`Downloading playlist: ${url}`);

      const downloadedVideos = await downloadPlaylist(url, videoDir);
      
      const savedVideos = [];
      const failedVideos = [];

      for (const videoData of downloadedVideos) {
        if (videoData.error) {
          failedVideos.push({
            title: videoData.title,
            error: videoData.message
          });
          continue;
        }

        try {
          const fileBaseName = path.parse(path.basename(videoData.filename)).name;
          const fileExt = path.parse(path.basename(videoData.filename)).ext;
          
          let finalVideoPath = videoData.filename;
          let finalSize = videoData.size;
          let final720pPath = null;
          let final720pSize = null;
          let videoHeight = null;

          try {
            console.log(`Processing: ${videoData.title}`);
            
            // First, get original video info to determine resolution
            const { getVideoInfo } = await import('../../../utils/ffmpeg.js');
            const videoInfo = await getVideoInfo(videoData.filename);
            videoHeight = videoInfo.height;
            
            // Process video: compress to 512MB and scale to 1080p if needed
            const processedFilename = `${fileBaseName}-${videoHeight}p${fileExt}`;
            const processedPath = path.join(videoDir, processedFilename);
            
            const processResult = await processVideo(videoData.filename, processedPath, 512);
            
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
            if (fs.existsSync(videoData.filename) && videoData.filename !== finalVideoPath) {
              fs.unlinkSync(videoData.filename);
            }
            
            finalSize = processResult.size;
            
            console.log(`Processed: ${processResult.actualSizeMB.toFixed(2)} MB at ${videoHeight}p`);
          } catch (processError) {
            console.warn('Processing failed, using original:', processError.message);
            // Keep original file
            finalVideoPath = videoData.filename;
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
              console.log(`720p: ${result720p.actualSizeMB.toFixed(2)} MB`);
            } catch (error720p) {
              console.warn('720p creation failed:', error720p.message);
            }
          }

          const thumbFilename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
          const thumbPath = path.join(thumbDir, thumbFilename);
          
          let thumbnailPath = null;
          try {
            if (videoData.thumbnail) {
              await downloadThumbnail(videoData.thumbnail, thumbPath);
              thumbnailPath = `/uploads/thumbnails/${thumbFilename}`;
            }
          } catch (thumbError) {
            console.warn('Thumbnail could not be downloaded:', thumbError.message);
          }

          const video = new Video({
            title: videoData.title,
            description: videoData.description || '',
            filename: finalVideoPath,
            filename720p: final720pPath,
            mimeType: videoData.mimeType,
            size: finalSize,
            size720p: final720pSize,
            thumbnail: thumbnailPath,
            duration: Math.floor(videoData.duration || 0),
            categories: categories || [],
            tags: tags || [],
            uploader: req.user._id
          });

          await video.save();
          savedVideos.push({
            id: video._id,
            title: video.title,
            playlistIndex: videoData.playlistIndex
          });
          console.log('Youtube playlist downloaded by ', req.user.username);
          console.log(`Saved to DB: ${video.title}`);
        } catch (dbError) {
          console.error(`DB save error (${videoData.title}):`, dbError.message);
          failedVideos.push({
            title: videoData.title,
            error: dbError.message
          });
        }
      }

      return reply.status(201).send({
        success: true,
        message: `${savedVideos.length} videos saved successfully`,
        savedVideos,
        failedVideos,
        total: downloadedVideos.length,
        successful: savedVideos.length,
        failed: failedVideos.length
      });

    } catch (error) {
      console.error('Playlist download error:', error);
      return reply.status(500).send({ 
        error: 'Playlist download failed', 
        message: error.message 
      });
    }
  }
}

