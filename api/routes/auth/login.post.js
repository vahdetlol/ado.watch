import { Route } from 'owebjs';
import jwt from 'jsonwebtoken';
import User from '../../models/User.js';

/**
 * POST /auth/login
 * Login user
 */
export default class extends Route {
  async handle(req, res) {
    try {
    const { username, email, password } = req.body;

    // Validation
    if ((!username && !email) || !password) {
      return res.status(400).send({
        success: false,
        message: 'Username/email and password are required'
      });
    }

    // Find user
    const user = await User.findOne({
      $or: [
        { username: username || '' },
        { email: email || '' }
      ]
    });

    if (!user) {
      return res.status(401).send({
        success: false,
        message: 'Invalid name or password'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).send({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).send({
        success: false,
        message: 'Invalid name or password'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = jwt.sign(
      { userId: user._id, level: user.level },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.send({
      success: true,
      message: 'Login successful',
      data: {
        user,
        token
      }
    });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).send({
        success: false,
        message: 'Login failed',
        error: error.message
      });
    }
  }
}
