import { Route } from 'owebjs';
import Tag from '../../models/tag.js';

// GET /api/tags - List all tags
export default class extends Route {
  async handle(req, res) {
    try {
      const tags = await Tag.find().sort({ name: 1 });
      res.send(tags);
    } catch (error) {
      res.status(500).send({ message: 'Tag\'s can\'t be retrieved', error: error.message });
    }
  }
}
