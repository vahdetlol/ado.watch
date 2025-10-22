import { Route } from 'owebjs';
import Video from '../../../models/Video.js';

// POST /api/videos/:id/view - Increase view count
export default class extends Route {
  async handle(req, reply) {
    try {
      const video = await Video.findByIdAndUpdate(
        req.params.id,
        { $inc: { views: 1 } },
        { new: true }
      );

      if (!video) return reply.status(404).send({ message: 'Video not found' });

      return reply.send({ views: video.views });
    } catch (error) {
      return reply.status(500).send({ message: 'Can\'t update view count', error: error.message });
    }
  }
}
