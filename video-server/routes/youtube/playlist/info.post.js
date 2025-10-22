import { Route } from 'owebjs';
import { 
  getPlaylistInfo,
  isPlaylistUrl
} from '../../../utils/youtube.js';

// POST /api/youtube/playlist/info - Get YouTube Playlist information
export default class extends Route {
  async handle(req, reply) {
    try {
      const { url } = req.body;

      if (!url) {
        return reply.status(400).send({ error: 'YouTube Playlist URL is required' });
      }

      if (!isPlaylistUrl(url)) {
        return reply.status(400).send({ error: 'Invalid YouTube Playlist URL' });
      }

      const playlistInfo = await getPlaylistInfo(url);

      return reply.send({
        success: true,
        playlist: playlistInfo
      });

    } catch (error) {
      console.error('Playlist info error:', error);
      return reply.status(500).send({ 
        error: 'Failed to fetch playlist information', 
        message: error.message 
      });
    }
  }
}

