const express = require('express');
const Tag = require('../models/tag');

const router = express.Router();

// Tüm tag'leri listele
router.get('/', async (req, res) => {
  try {
    const tags = await Tag.find().sort({ name: 1 });
    res.json(tags);
  } catch (error) {
    res.status(500).json({ message: 'Tag\'s can\'t be retrieved', error: error.message });
  }
});

// Tek tag getir
router.get('/:id', async (req, res) => {
  try {
    const tag = await Tag.findById(req.params.id);
    if (!tag) return res.status(404).json({ message: 'Tag not found' });
    res.json(tag);
  } catch (error) {
    res.status(500).json({ message: 'Can\'t retrieve tag', error: error.message });
  }
});

// Yeni tag oluştur
router.post('/', async (req, res) => {
  try {
    const { name, slug } = req.body;
    
    if (!name || !slug) {
      return res.status(400).json({ message: 'Name and slug are required' });
    }

    const tag = new Tag({ name, slug });
    await tag.save();
    
    res.status(201).json(tag);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'This tag already exists' });
    }
    res.status(500).json({ message: 'Can\'t create tag', error: error.message });
  }
});

// Tag güncelle
router.put('/:id', async (req, res) => {
  try {
    const { name, slug } = req.body;
    const tag = await Tag.findByIdAndUpdate(
      req.params.id,
      { name, slug },
      { new: true }
    );

    if (!tag) return res.status(404).json({ message: 'Tag not found' });
    res.json(tag);
  } catch (error) {
    res.status(500).json({ message: 'Can\'t update tag', error: error.message });
  }
});

// Tag sil
router.delete('/:id', async (req, res) => {
  try {
    const tag = await Tag.findByIdAndDelete(req.params.id);
    if (!tag) return res.status(404).json({ message: 'Tag not found' });
    res.json({ message: 'Tag deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Can\'t delete tag', error: error.message });
  }
});

module.exports = router;
