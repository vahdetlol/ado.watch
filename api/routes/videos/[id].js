import { Route } from 'owebjs';
import Video from '../../models/Video.js';

// GET /videos/:id - Get single video metadata
export default class extends Route {
  async handle(req, res) {
    try {
      const video = await Video.findById(req.params.id);

      if (!video) return res.status(404).send({ error: 'Video not found' });

      res.send(video);
    } catch (error) {
      res.status(500).send({ message: 'Can\'t retrieve video', error: error.message });
    }
  }
}
