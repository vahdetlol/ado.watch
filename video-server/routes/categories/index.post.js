import { Route } from 'owebjs';
import Category from '../../models/category.js';

// POST /categories - Create a new category
export default class extends Route {
  async handle(req, res) {
    try {
      const { name, slug } = req.body;

      if (!name || !slug) {
        return res.status(400).send({ 
          success: false,
          message: "Name and slug are required" 
        });
      }

      const category = new Category({ name, slug });
      await category.save();

      res.status(201).send({
        success: true,
        message: 'Category created successfully',
        data: category
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).send({ 
          success: false,
          message: "This category already exists" 
        });
      }
      res.status(500).send({ 
        success: false,
        message: "Can't create category", 
        error: error.message 
      });
    }
  }
}
