import { Route } from 'owebjs';

// GET /api/health - Health check
export default class extends Route {
  async handle(req, reply) {
    return reply.send({ status: 'OK', timestamp: new Date() });
  }
}

