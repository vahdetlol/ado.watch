import { Route } from 'owebjs';

// GET /api - Ana endpoint
export default class extends Route {
  async handle(req, reply) {
    return reply.send('everything is for ado :heart:');
  }
}

