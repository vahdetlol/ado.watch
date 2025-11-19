import { Route } from 'owebjs';
import Category from '../../models/category.js';

// PUT /categories/:id - Update category
export default class extends Route {
  async handle(req, res) {
  try {
    const { name, slug } = req.body;
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { name, slug },
      { new: true }
    );

    if (!category) {
      return res.status(404).send({ 
        success: false,
        message: "Category not found" 
      });
    }
    res.send({
      success: true,
      message: 'Category updated successfully',
      data: category
    });
    } catch (error) {
      res.status(500).send({ 
        success: false,
        message: "Can't update category", 
        error: error.message 
      });
    }
  }
}
