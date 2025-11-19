import { Route } from 'owebjs';
import { authenticate } from '../../middleware/auth.js';

/**
 * GET /auth/me
 * Get current user profile
 */
export default class extends Route {
  async handle(req, res) {
    await authenticate(req, res);
    if (res.sent) return;

    try {
      const userData = req.user.toJSON ? req.user.toJSON() : req.user;
      
      res.send({
        success: true,
        data: userData
      });
    } catch (error) {
      res.status(500).send({
        success: false,
        message: 'Failed to get user profile',
        error: error.message
      });
    }
  }
}
