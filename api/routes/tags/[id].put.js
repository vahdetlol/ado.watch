import { Route } from 'owebjs';
import Tag from '../../models/tag.js';

// PUT /api/tags/:id - Tag güncelle
export default class extends Route {
  async handle(req, res) {
    try {
      const { name, slug } = req.body;
      const tag = await Tag.findByIdAndUpdate(
        req.params.id,
        { name, slug },
        { new: true }
      );

      if (!tag) return res.status(404).send({ message: 'Tag not found' });
      res.send(tag);
    } catch (error) {
      res.status(500).send({ message: 'Can\'t update tag', error: error.message });
    }
  }
}
