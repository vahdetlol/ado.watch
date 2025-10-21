const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const Video = require('../models/Video');
const { extractThumbnail, getDuration } = require('../utils/ffmpeg');

const router = express.Router();

// Klasörler
const videoDir = path.join(__dirname, '..', 'uploads', 'videos');
const thumbDir = path.join(__dirname, '..', 'uploads', 'thumbnails');

if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });
if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, videoDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

// File filter - sadece video dosyaları
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only video files are allowed'), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 } // 2 GB limit
});

router.post('/', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Video file is required' });

    const file = req.file;

    // Thumbnail path hazırla
    const thumbPath = path.join(thumbDir, file.filename.replace(path.extname(file.filename), '.jpg'));

    // FFmpeg thumbnail + duration
    await extractThumbnail(file.path, thumbPath);
    const duration = await getDuration(file.path);

    // Categories ve tags'i parse et
    let categories = [];
    let tags = [];

    if (req.body.categories) {
      try {
        categories = JSON.parse(req.body.categories);
        // Eğer array değilse, array yap
        if (!Array.isArray(categories)) {
          categories = [categories];
        }
      } catch (e) {
        // Parse edilemezse, string olarak kullan
        categories = [req.body.categories];
      }
    }

    if (req.body.tags) {
      try {
        tags = JSON.parse(req.body.tags);
        // Eğer array değilse, array yap
        if (!Array.isArray(tags)) {
          tags = [tags];
        }
      } catch (e) {
        // Parse edilemezse, string olarak kullan
        tags = [req.body.tags];
      }
    }

    const video = new Video({
      title: req.body.title || file.originalname,
      description: req.body.description || '',
      filename: file.path,
      mimeType: file.mimetype,
      size: file.size,
      thumbnail: `/uploads/thumbnails/${path.basename(thumbPath)}`,
      duration: Math.floor(duration),
      categories: categories,
      tags: tags
    });

    await video.save();

    return res.status(201).json({
      success: true,
      video: {
        id: video._id,
        title: video.title,
        thumbnail: video.thumbnail,
        duration: video.duration
      }
    });

  } catch (err) {
    console.error(err);
    // Hata durumunda yüklenen dosyayı temizle
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(500).json({ error: 'Video processing error', message: err.message });
  }
});

module.exports = router;
