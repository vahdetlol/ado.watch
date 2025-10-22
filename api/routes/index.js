import { Route } from 'owebjs';

// GET /api - Root endpoint
export default class extends Route {
  async handle(req, res) {
    res.send('everything is for ado :heart:');
  }
}
