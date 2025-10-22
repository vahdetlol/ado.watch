import { Route } from 'owebjs';
import Category from '../../../models/category.js';

// DELETE /api/categories/:id - Kategori sil
export default class extends Route {
  async handle(req, res) {
    try {
      const category = await Category.findByIdAndDelete(req.params.id);
      if (!category) return res.status(404).send({ message: "Can't retrieve category" });
      res.send({ message: "Category deleted" });
    } catch (error) {
      res.status(500).send({ message: "Can't delete category", error: error.message });
    }
  }
}
