const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Video = require('../models/Video');
const { extractThumbnail, getDuration } = require('../utils/ffmpeg');

const router = express.Router();

// Klasörleri oluştur
const videoDir = path.join(__dirname, '..', 'uploads', 'videos');
const thumbDir = path.join(__dirname, '..', 'uploads', 'thumbnails');

if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });
if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });

// Multer storage konfigürasyonu
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, videoDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// Dosya filtresi (sadece video dosyaları)
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

/**
 * Video yükle
 * POST /api/upload
 * Form-data: video (file), title, description, categories[], tags[]
 */
router.post('/', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded' });
    }

    const { title, description, categories, tags } = req.body;
    const videoPath = req.file.path;

    console.log(`📤 Video uploaded: ${req.file.originalname}`);

    // FFmpeg ile thumbnail oluştur
    const thumbFilename = `${path.parse(req.file.filename).name}.jpg`;
    const thumbPath = path.join(thumbDir, thumbFilename);

    let thumbnailUrl = null;
    let duration = 0;

    try {
      // İlk kareden thumbnail oluştur
      await extractThumbnail(videoPath, thumbPath);
      thumbnailUrl = `/uploads/thumbnails/${thumbFilename}`;
      console.log(`✅ Thumbnail created: ${thumbFilename}`);

      // Video süresini al
      duration = await getDuration(videoPath);
      console.log(`⏱️ Duration: ${duration}s`);
    } catch (ffmpegError) {
      console.warn('⚠️ FFmpeg error:', ffmpegError.message);
      // FFmpeg hatası olsa bile devam et
    }

    // Veritabanına kaydet
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

    return res.status(201).json({
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

    // Hata durumunda yüklenen dosyayı sil
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(500).json({
      error: 'Video upload failed',
      message: error.message
    });
  }
});

/**
 * Çoklu video yükleme
 * POST /api/upload/multiple
 * Form-data: videos[] (files), categories[], tags[]
 */
router.post('/multiple', upload.array('videos', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No video files uploaded' });
    }

    const { categories, tags } = req.body;
    const uploadedVideos = [];
    const failedVideos = [];

    for (const file of req.files) {
      try {
        const videoPath = file.path;

        // Thumbnail oluştur
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

        // Veritabanına kaydet
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

        // Hatalı dosyayı sil
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }
    }

    return res.status(201).json({
      success: true,
      message: `${uploadedVideos.length} video uploaded successfully`,
      uploadedVideos,
      failedVideos,
      total: req.files.length,
      successful: uploadedVideos.length,
      failed: failedVideos.length
    });

  } catch (error) {
    console.error('Multiple upload error:', error);

    // Hata durumunda tüm yüklenen dosyaları sil
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }

    return res.status(500).json({
      error: 'Multiple video upload failed',
      message: error.message
    });
  }
});

module.exports = router;
