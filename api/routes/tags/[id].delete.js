import { Route } from 'owebjs';
import Tag from '../../models/tag.js';

// DELETE /api/tags/:id - Tag sil
export default class extends Route {
  async handle(req, res) {
    try {
      const tag = await Tag.findByIdAndDelete(req.params.id);
      if (!tag) return res.status(404).send({ message: 'Tag not found' });
      res.send({ message: 'Tag deleted' });
    } catch (error) {
      res.status(500).send({ message: 'Can\'t delete tag', error: error.message });
    }
  }
}
