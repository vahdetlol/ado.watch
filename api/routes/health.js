import { Route } from 'owebjs';
import { getNow, formatDate } from '../utils/timezone.js';
export default class extends Route {

  async handle(req, res) {
    let response;
    try {
      response = await fetch(`${process.env.VIDEO_SERVER_URL}/health`, {
        method: 'GET',
      });
    } catch (error) {
      response = { ok: false };
    }

    return res.send({ status: 'OK',
      timestamp: new Date(),
      formattedDate: formatDate(getNow()),
      videoServer: response.ok ? await response.json() : 'can\'t connect to video server',
    });
  }
}

