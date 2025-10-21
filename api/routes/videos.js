import express from 'express';
import Video from '../models/Video.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Tüm videoları listele (pagination + filtering)
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, category, tag, search } = req.query;
    const query = {};

    if (category) query.categories = category;
    if (tag) query.tags = tag;
    if (search) query.title = { $regex: search, $options: 'i' };

    const videos = await Video.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Video.countDocuments(query);

    res.json({
      videos,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count
    });
  } catch (error) {
    res.status(500).json({ message: 'Can\'t retrieve videos', error: error.message });
  }
});

// Tek video metadata
router.get('/:id', async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);

    if (!video) return res.status(404).json({ error: 'Video not found' });

    res.json(video);
  } catch (error) {
    res.status(500).json({ message: 'Can\'t retrieve video', error: error.message });
  }
});

// Video güncelle
router.put('/:id', async (req, res) => {
  try {
    const { title, description, categories, tags } = req.body;
    const updated = await Video.findByIdAndUpdate(
      req.params.id,
      { title, description, categories, tags },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: 'Video not found' });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Can\'t update video', error: error.message });
  }
});

// Video sil (fiziksel dosya + DB)
router.delete('/:id', async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ message: 'Video not found' });

    // Fiziksel dosyaları sil
    if (fs.existsSync(video.filename)) {
      fs.unlinkSync(video.filename);
    }
    if (video.thumbnail) {
      const thumbPath = path.join(__dirname, '..', video.thumbnail);
      if (fs.existsSync(thumbPath)) {
        fs.unlinkSync(thumbPath);
      }
    }

    await Video.findByIdAndDelete(req.params.id);
    res.json({ message: 'Video deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Can\'t delete video', error: error.message });
  }
});

// İzlenme sayısını artır
router.post('/:id/view', async (req, res) => {
  try {
    const video = await Video.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true }
    );

    if (!video) return res.status(404).json({ message: 'Video not found' });

    res.json({ views: video.views });
  } catch (error) {
    res.status(500).json({ message: 'Can\'t update view count', error: error.message });
  }
});

export default router;
