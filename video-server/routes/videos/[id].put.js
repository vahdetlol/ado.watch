import { Route } from 'owebjs';
import Video from '../../models/Video.js';

// PUT /api/videos/:id - Video güncelle
export default class extends Route {
  async handle(req, reply) {
    try {
      const { title, description, categories, tags } = req.body;
      const updated = await Video.findByIdAndUpdate(
        req.params.id,
        { title, description, categories, tags },
        { new: true }
      );

      if (!updated) return reply.status(404).send({ message: 'Video not found' });

      return reply.send(updated);
    } catch (error) {
      return reply.status(500).send({ message: 'Can\'t update video', error: error.message });
    }
  }
}
