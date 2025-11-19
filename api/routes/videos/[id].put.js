import { Route } from 'owebjs';
import { authenticate, authorize } from '../../middleware/auth.js';
import { proxyToVideoServer, sendProxiedResponse } from '../../utils/videoServerProxy.js';

// PUT /videos/:id - Proxy to video-server for video update
export default class extends Route {
  async handle(req, reply) {
    await authenticate(req, reply);
    if (reply.sent) return;

    await authorize('admin', 'moderator', 'uploader')(req, reply);
    if (reply.sent) return;

    try {
      const response = await proxyToVideoServer(`/videos/${req.params.id}`, {
        method: 'PUT',
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
      console.error('Video update proxy error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to connect to video server',
        error: error.message
      });
    }
  }
}
