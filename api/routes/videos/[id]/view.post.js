import { Route } from 'owebjs';
import Video from '../../../models/Video.js';

// POST /api/videos/:id/view - İzlenme sayısını artır
export default class extends Route {
  async handle(req, res) {
    try {
      const video = await Video.findByIdAndUpdate(
        req.params.id,
        { $inc: { views: 1 } },
        { new: true }
      );

      if (!video) return res.status(404).send({ message: 'Video not found' });

      res.send({ views: video.views });
    } catch (error) {
      res.status(500).send({ message: 'Can\'t update view count', error: error.message });
    }
  }
}
