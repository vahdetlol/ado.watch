import { Route } from 'owebjs';
import Category from '../../../models/category.js';

// GET /api/categories - Tüm kategorileri listele
export default class extends Route {
  async handle(req, res) {
    try {
      const categories = await Category.find().sort({ name: 1 });
      res.send(categories);
    } catch (error) {
      res.status(500).send({ message: "Can't retrieve categories", error: error.message });
    }
  }
}
