import { Route } from 'owebjs';
import Category from '../../models/category.js';

// PUT /api/categories/:id - Kategori güncelle
export default class extends Route {
  async handle(req, res) {
    try {
      const { name, slug } = req.body;
      const category = await Category.findByIdAndUpdate(
        req.params.id,
        { name, slug },
        { new: true }
      );

      if (!category) return res.status(404).send({ message: "Can't retrieve category" });
      res.send(category);
    } catch (error) {
      res.status(500).send({ message: "Can't update category", error: error.message });
    }
  }
}
