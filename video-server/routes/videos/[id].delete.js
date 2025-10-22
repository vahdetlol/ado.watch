import { Route } from 'owebjs';
import Video from '../../models/Video.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DELETE /api/videos/:id - Video sil (fiziksel dosya + DB)
export default class extends Route {
  async handle(req, reply) {
    try {
      const video = await Video.findById(req.params.id);
      if (!video) return reply.status(404).send({ message: 'Video not found' });

      // Fiziksel dosyaları sil
      if (fs.existsSync(video.filename)) {
        fs.unlinkSync(video.filename);
      }
      if (video.thumbnail) {
        // Ana proje dizinindeki uploads klasörü
        const thumbPath = path.join(__dirname, '..', '..', '..', video.thumbnail);
        if (fs.existsSync(thumbPath)) {
          fs.unlinkSync(thumbPath);
        }
      }

      await Video.findByIdAndDelete(req.params.id);
      return reply.send({ message: 'Video deleted' });
    } catch (error) {
      return reply.status(500).send({ message: 'Can\'t delete video', error: error.message });
    }
  }
}
