import { Route } from 'owebjs';
import Video from '../../models/Video.js';

// GET /api/videos/:id - Tek video metadata
export default class extends Route {
  async handle(req, reply) {
    try {
      const video = await Video.findById(req.params.id);

      if (!video) return reply.status(404).send({ error: 'Video not found' });

      return reply.send(video);
    } catch (error) {
      return reply.status(500).send({ message: 'Can\'t retrieve video', error: error.message });
    }
  }
}
