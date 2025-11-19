import { Route } from 'owebjs';
import { authenticate } from '../../middleware/auth.js';

// POST /upload/multiple - Proxy to video-server for multiple video upload
export default class extends Route {
  async handle(req, reply) {
    await authenticate(req, reply);
    if (reply.sent) return;

    try {
      const VIDEO_SERVER_URL = process.env.VIDEO_SERVER_URL || 'http://127.0.0.1:5001';
      const url = `${VIDEO_SERVER_URL}/upload/multiple`;

      // Forward the raw request to video-server
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...req.headers,
          'x-user-id': req.user._id.toString(),
          'x-user-username': req.user.username,
        },
        body: req.raw,
        duplex: 'half',
      });

      // Get response data
      const data = await response.json();
      
      // Forward response
      return reply.status(response.status).send(data);
      
    } catch (error) {
      console.error('Upload proxy error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to connect to video server',
        error: error.message
      });
    }
  }
}
