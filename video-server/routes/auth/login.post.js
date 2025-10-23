import { Route } from 'owebjs';
import jwt from 'jsonwebtoken';
import User from '../../models/User.js';
import { bruteForceProtection, recordLoginAttempt } from '../../middleware/bruteForce.js';
import { getNow } from '../../utils/timezone.js';

export default class extends Route {
  middleware = [bruteForceProtection];

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

    const user = await User.findOne({
      $or: [
        { username: username || '' },
        { email: email || '' }
      ]
    });

    if (!user) {
      await recordLoginAttempt(req, false);
      
      return res.status(401).send({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (!user.isActive) {
      await recordLoginAttempt(req, false);
      
      return res.status(403).send({
        success: false,
        message: 'Account is deactivated'
      });
    }

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      await recordLoginAttempt(req, false);
      
      return res.status(401).send({
        success: false,
        message: 'Invalid credentials'
      });
    }

    user.lastLogin = getNow();
    await user.save();

    await recordLoginAttempt(req, true);

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
