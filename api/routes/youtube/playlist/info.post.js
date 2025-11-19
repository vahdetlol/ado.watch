import { Route } from 'owebjs';
import { proxyToVideoServer, sendProxiedResponse } from '../../../utils/videoServerProxy.js';

// POST /youtube/playlist/info - Proxy to video-server for YouTube playlist info
export default class extends Route {
  async handle(req, reply) {
    try {
      const response = await proxyToVideoServer('/youtube/playlist/info', {
        method: 'POST',
        body: req.body,
      });

      await sendProxiedResponse(reply, response);
      
    } catch (error) {
      console.error('YouTube playlist info proxy error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to connect to video server',
        error: error.message
      });
    }
  }
}
