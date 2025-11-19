import { Route } from 'owebjs';
import Tag from '../../models/tag.js';

// GET /tags/:id - Get a single tag
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
