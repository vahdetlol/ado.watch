import { Route } from 'owebjs';
import Category from '../../models/category.js';

// GET /categories/:id - Get a single category
export default class extends Route {
  async handle(req, res) {
    try {
      const category = await Category.findById(req.params.id);
      if (!category) return res.status(404).send({ message: "Can't retrieve category" });
      res.send(category);
    } catch (error) {
      res.status(500).send({ message: "Can't retrieve category", error: error.message });
    }
  }
}
