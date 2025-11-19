import { Route } from 'owebjs';
import { authenticate, authorize } from '../../middleware/auth.js';
import { proxyToVideoServer, sendProxiedResponse } from '../../utils/videoServerProxy.js';

// PUT /tags/:id - Proxy to video-server for tag update
export default class extends Route {
  async handle(req, reply) {
    await authenticate(req, reply);
    if (reply.sent) return;

        await authorize('admin', 'moderator', 'uploader')(req, reply);
    if (reply.sent) return;

    try {
      const response = await proxyToVideoServer(`/tags/${req.params.id}`, {
        method: 'PUT',
        body: req.body,
      });

      await sendProxiedResponse(reply, response);
      
    } catch (error) {
      console.error('Tag update proxy error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to connect to video server',
        error: error.message
      });
    }
  }
}
