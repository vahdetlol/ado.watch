import { Route } from 'owebjs';
import { authenticate } from '../../middleware/auth.js';

/**
 * GET /auth/me
 * Get current user profile
 */
export default class extends Route {
  middleware = [authenticate];

  async handle(req, res) {
    try {
      res.send({
        success: true,
        data: {
          user: req.user
        }
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
