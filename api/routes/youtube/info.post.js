import { Route } from 'owebjs';
import { proxyToVideoServer, sendProxiedResponse } from '../../utils/videoServerProxy.js';

// POST /youtube/info - Proxy to video-server for YouTube info
export default class extends Route {
  async handle(req, reply) {
    try {
      console.log('YouTube info request body type:', typeof req.body);
      console.log('YouTube info request body:', req.body);
      
      const response = await proxyToVideoServer('/youtube/info', {
        method: 'POST',
        body: req.body,
      });

      await sendProxiedResponse(reply, response);
      
    } catch (error) {
      console.error('YouTube info proxy error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to connect to video server',
        error: error.message
      });
    }
  }
}
