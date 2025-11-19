import { Route } from 'owebjs';
import jwt from 'jsonwebtoken';
import { authenticate } from '../../middleware/auth.js';

/**
 * GET /auth/refresh
 * Refresh JWT token
 */
export default class extends Route {
  async handle(req, res) {
    await authenticate(req, res);
    if (res.sent) return;

    try {
      const token = jwt.sign(
        { userId: req.user._id, level: req.user.level },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.send({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          token
        }
      });

    } catch (error) {
      res.status(500).send({
        success: false,
        message: 'Failed to refresh token',
        error: error.message
      });
    }
  }
}
