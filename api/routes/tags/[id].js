import { Route } from 'owebjs';
import Tag from '../../../models/tag.js';

// GET /api/tags/:id - Tek tag getir
export default class extends Route {
  async handle(req, res) {
    try {
      const tag = await Tag.findById(req.params.id);
      if (!tag) return res.status(404).send({ message: 'Tag not found' });
      res.send(tag);
    } catch (error) {
      res.status(500).send({ message: 'Can\'t retrieve tag', error: error.message });
    }
  }
}
