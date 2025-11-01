import { Route } from 'owebjs';
import Category from '../../models/category.js';
import { authenticate, authorize } from '../../middleware/auth.js';

// DELETE /api/categories/:id - Delete category (Admin only)
export default class extends Route {
  middleware = [authenticate, authorize('admin')];

  async handle(req, res) {
    try {
      const category = await Category.findByIdAndDelete(req.params.id);
      if (!category) {
        return res.status(404).send({ 
          success: false,
          message: "Category not found" 
        });
      }
      res.send({ 
        success: true,
        message: "Category deleted successfully" 
      });
    } catch (error) {
      res.status(500).send({ 
        success: false,
        message: "Can't delete category", 
        error: error.message 
      });
    }
  }
}
