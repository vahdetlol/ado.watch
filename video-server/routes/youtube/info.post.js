import { Route } from 'owebjs';
import { 
  getYouTubeInfo,
  isYouTubeUrl
} from '../../utils/youtube.js';

// POST /api/youtube/info - YouTube video bilgilerini al
export default class extends Route {
  async handle(req, reply) {
    try {
      const { url } = req.body;

      if (!url) {
        return reply.status(400).send({ error: 'YouTube URL is required' });
      }

      if (!isYouTubeUrl(url)) {
        return reply.status(400).send({ error: 'Invalid YouTube URL' });
      }

      const info = await getYouTubeInfo(url);

      return reply.send({
        success: true,
        info
      });

    } catch (error) {
      console.error('YouTube info error:', error);
      return reply.status(500).send({ 
        error: 'Can\'t retrieve video info', 
        message: error.message 
      });
    }
  }
}

