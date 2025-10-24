import { Route } from 'owebjs';
export default class extends Route {
  async handle(req, res) {
    res.send({ status: 'OK', timestamp: new Date() });
  }
}
