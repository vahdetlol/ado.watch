const express = require('express');
const Category = require('../models/category');

const router = express.Router();

// Tüm kategorileri listele
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Can\'t retrieve categories', error: error.message });
  }
});

// Tek kategori getir
router.get('/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: 'Can\'t retrieve category' });
    res.json(category);
  } catch (error) {
    res.status(500).json({ message: 'Can\'t retrieve category', error: error.message });
  }
});

// Yeni kategori oluştur
router.post('/', async (req, res) => {
  try {
    const { name, slug } = req.body;
    
    if (!name || !slug) {
      return res.status(400).json({ message: 'Name and slug are required' });
    }

    const category = new Category({ name, slug });
    await category.save();
    
    res.status(201).json(category);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'This category already exists' });
    }
    res.status(500).json({ message: 'Can\'t create category', error: error.message });
  }
});

// Kategori güncelle
router.put('/:id', async (req, res) => {
  try {
    const { name, slug } = req.body;
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { name, slug },
      { new: true }
    );

    if (!category) return res.status(404).json({ message: 'Can\'t retrieve category' });
    res.json(category);
  } catch (error) {
    res.status(500).json({ message: 'Can\'t update category', error: error.message });
  }
});

// Kategori sil
router.delete('/:id', async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ message: 'Can\'t retrieve category' });
    res.json({ message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Can\'t delete category', error: error.message });
  }
});

module.exports = router;
