import { Route } from 'owebjs';
import Tag from '../../../models/tag.js';

// POST /api/tags - Yeni tag oluştur
export default class extends Route {
  async handle(req, res) {
    try {
      const { name, slug } = req.body;
      
      if (!name || !slug) {
        return res.status(400).send({ message: 'Name and slug are required' });
      }

      const tag = new Tag({ name, slug });
      await tag.save();
      
      res.status(201).send(tag);
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).send({ message: 'This tag already exists' });
      }
      res.status(500).send({ message: 'Can\'t create tag', error: error.message });
    }
  }
}
