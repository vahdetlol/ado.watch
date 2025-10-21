import express from 'express';
import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Video from '../models/Video.js';
import { 
  downloadFromYouTube, 
  getYouTubeInfo, 
  getPlaylistInfo,
  downloadPlaylist,
  isYouTubeUrl,
  isPlaylistUrl 
} from '../utils/youtube.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

const videoDir = path.join(__dirname, '..', 'uploads', 'videos');
const thumbDir = path.join(__dirname, '..', 'uploads', 'thumbnails');

if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });
if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });

/**
 * Thumbnail'i URL'den indir
 */
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
        fs.unlink(outputPath, () => {}); // Hatalı dosyayı sil
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
};

/**
 * YouTube'dan video indir ve kaydet
 * POST /api/youtube/download
 * Body: { url: "https://youtube.com/watch?v=...", title?: "Custom Title", categories?: [], tags?: [] }
 */
router.post('/download', async (req, res) => {
  try {
    const { url, title, description, categories, tags } = req.body;

    // URL kontrolü
    if (!url) {
      return res.status(400).json({ error: 'YouTube URL is required' });
    }

    if (!isYouTubeUrl(url)) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    // Videoyu indir
    console.log(`📥 Downloading: ${url}`);
    const downloadResult = await downloadFromYouTube(url, videoDir);

    // YouTube'dan gelen thumbnail'i indir
    const thumbFilename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
    const thumbPath = path.join(thumbDir, thumbFilename);
    
    try {
      // Thumbnail varsa indir
      if (downloadResult.thumbnail) {
        await downloadThumbnail(downloadResult.thumbnail, thumbPath);
        console.log(`✅ Thumbnail downloaded: ${thumbFilename}`);
      }
    } catch (thumbError) {
      console.warn('⚠️ Thumbnail download failed:', thumbError.message);
      // Thumbnail hatasında devam et, thumbnail olmadan da video kaydedilebilir
    }

    // Veritabanına kaydet
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

    console.log(`✅ Video saved: ${video.title}`);

    return res.status(201).json({
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
    return res.status(500).json({ 
      error: 'YouTube download failed', 
      message: error.message 
    });
  }
});

/**
 * YouTube video bilgilerini al (indirmeden önce önizleme için)
 * POST /api/youtube/info
 * Body: { url: "https://youtube.com/watch?v=..." }
 */
router.post('/info', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'YouTube URL is required' });
    }

    if (!isYouTubeUrl(url)) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    const info = await getYouTubeInfo(url);

    return res.json({
      success: true,
      info
    });

  } catch (error) {
    console.error('YouTube info error:', error);
    return res.status(500).json({ 
      error: 'Can\'t retrieve video info', 
      message: error.message 
    });
  }
});

/**
 * YouTube Playlist bilgilerini al
 * POST /api/youtube/playlist/info
 * Body: { url: "https://youtube.com/playlist?list=..." }
 */
router.post('/playlist/info', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'YouTube Playlist URL is required' });
    }

    if (!isPlaylistUrl(url)) {
      return res.status(400).json({ error: 'Invalid YouTube Playlist URL' });
    }

    const playlistInfo = await getPlaylistInfo(url);

    return res.json({
      success: true,
      playlist: playlistInfo
    });

  } catch (error) {
    console.error('Playlist info error:', error);
    return res.status(500).json({ 
      error: 'Playlist bilgileri alınamadı', 
      message: error.message 
    });
  }
});

/**
 * YouTube Playlist'ten tüm videoları indir
 * POST /api/youtube/playlist/download
 * Body: { url: "https://youtube.com/playlist?list=...", categories?: [], tags?: [] }
 */
router.post('/playlist/download', async (req, res) => {
  try {
    const { url, categories, tags } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'YouTube Playlist URL is required' });
    }

    if (!isPlaylistUrl(url)) {
      return res.status(400).json({ error: 'Invalid YouTube Playlist URL' });
    }

    console.log(`📋 Downloading playlist: ${url}`);

    // Playlist'teki tüm videoları indir
    const downloadedVideos = await downloadPlaylist(url, videoDir);
    
    const savedVideos = [];
    const failedVideos = [];

    // Her indirilen videoyu veritabanına kaydet
    for (const videoData of downloadedVideos) {
      if (videoData.error) {
        failedVideos.push({
          title: videoData.title,
          error: videoData.message
        });
        continue;
      }

      try {
        // Thumbnail indir
        const thumbFilename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
        const thumbPath = path.join(thumbDir, thumbFilename);
        
        let thumbnailPath = null;
        try {
          if (videoData.thumbnail) {
            await downloadThumbnail(videoData.thumbnail, thumbPath);
            thumbnailPath = `/uploads/thumbnails/${thumbFilename}`;
          }
        } catch (thumbError) {
          console.warn('⚠️ Thumbnail indirilemedi:', thumbError.message);
        }

        // Veritabanına kaydet
        const video = new Video({
          title: videoData.title,
          description: videoData.description || '',
          filename: videoData.filename,
          mimeType: videoData.mimeType,
          size: videoData.size,
          thumbnail: thumbnailPath,
          duration: Math.floor(videoData.duration || 0),
          categories: categories || [],
          tags: tags || []
        });

        await video.save();
        savedVideos.push({
          id: video._id,
          title: video.title,
          playlistIndex: videoData.playlistIndex
        });

        console.log(`✅ DB'ye kaydedildi: ${video.title}`);
      } catch (dbError) {
        console.error(`❌ DB kayıt hatası (${videoData.title}):`, dbError.message);
        failedVideos.push({
          title: videoData.title,
          error: dbError.message
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: `${savedVideos.length} video başarıyla kaydedildi`,
      savedVideos,
      failedVideos,
      total: downloadedVideos.length,
      successful: savedVideos.length,
      failed: failedVideos.length
    });

  } catch (error) {
    console.error('Playlist download error:', error);
    return res.status(500).json({ 
      error: 'Playlist download failed', 
      message: error.message 
    });
  }
});

export default router;
