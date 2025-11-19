import { Route } from 'owebjs';
import { authenticate, authorize } from '../../middleware/auth.js';
import { proxyToVideoServer, sendProxiedResponse } from '../../utils/videoServerProxy.js';

// POST /youtube/download - Proxy to video-server for YouTube download
export default class extends Route {
  async handle(req, reply) {
    await authenticate(req, reply);
    if (reply.sent) return;

    
    await authorize('admin', 'moderator', 'uploader')(req, reply);
    if (reply.sent) return;

    try {
      const response = await proxyToVideoServer('/youtube/download', {
        method: 'POST',
        body: {
          ...req.body,
          _user: {
            _id: req.user._id,
            username: req.user.username,
          },
        },
      });

      await sendProxiedResponse(reply, response);
      
    } catch (error) {
      console.error('YouTube download proxy error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to connect to video server',
        error: error.message
      });
    }
  }
}
