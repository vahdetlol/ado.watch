import { Route } from 'owebjs';
import { authenticate, authorize } from '../../middleware/auth.js';
import { proxyToVideoServer, sendProxiedResponse } from '../../utils/videoServerProxy.js';

// POST /categories - Proxy to video-server for category creation
export default class extends Route {
  async handle(req, reply) {
    await authenticate(req, reply);
    if (reply.sent) return;

    // Authorize (admin only)
    await authorize('admin')(req, reply);
    if (reply.sent) return;

    try {
      const response = await proxyToVideoServer('/categories', {
        method: 'POST',
        body: req.body,
      });

      await sendProxiedResponse(reply, response);
      
    } catch (error) {
      console.error('Category create proxy error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to connect to video server',
        error: error.message
      });
    }
  }
}
