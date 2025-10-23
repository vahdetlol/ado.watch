import { Route } from 'owebjs';
import { getNow, formatDate } from '../utils/timezone.js';

// GET /api/health - Health check
export default class extends Route {
  async handle(req, reply) {
    return reply.send({ 
      status: 'OK', 
      timestamp: getNow(),
      formatted: formatDate(getNow())
    });
  }
}

