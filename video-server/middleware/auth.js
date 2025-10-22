import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Auth middleware
 * Verifies JWT token and attaches user to request
 */
export const authenticate = async (req, res) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Auth failed: No token provided');
      console.log(`   URL: ${req.method} ${req.url}`);
      console.log(`   IP: ${req.ip || req.socket.remoteAddress}`);
      return res.status(401).send({
        success: false,
        message: 'No token provided. Please login.'
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      console.log('Auth failed: User not found');
      console.log(`   User ID: ${decoded.userId}`);
      console.log(`   URL: ${req.method} ${req.url}`);
      return res.status(401).send({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.isActive) {
      console.log('Auth failed: Account deactivated');
      console.log(`   User: ${user.username} (${user.email})`);
      console.log(`   URL: ${req.method} ${req.url}`);
      return res.status(403).send({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Attach user to request
    req.user = user;
    console.log(`User authenticated: ${user.username} [${user.level}]`);
    
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      console.log('Auth failed: Invalid token');
      console.log(`   URL: ${req.method} ${req.url}`);
      console.log(`   Error: ${error.message}`);
      return res.status(401).send({
        success: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      console.log('Auth failed: Token expired');
      console.log(`   URL: ${req.method} ${req.url}`);
      console.log(`   Expired at: ${error.expiredAt}`);
      return res.status(401).send({
        success: false,
        message: 'Token expired'
      });
    }

    console.error('Auth error:', error);
    return res.status(500).send({
      success: false,
      message: 'Auth error',
      error: error.message
    });
  }
};

/**
 * Authorization middleware factory
 * Creates middleware that checks user level
 * @param {string[]} allowedLevels - Array of allowed user levels
 */
export const authorize = (...allowedLevels) => {
  return async (req, res) => {
    
    try {
      if (!req.user) {
        console.log('Auth failed: User not authenticated');
        console.log(`   URL: ${req.method} ${req.url}`);
        return res.status(401).send({
          success: false,
          message: 'Please authenticate first'
        });
      }

      if (!allowedLevels.includes(req.user.level)) {
        console.log('Auth failed: Insufficient permissions');
        console.log(`   User: ${req.user.username} [${req.user.level}]`);
        console.log(`   Required: ${allowedLevels.join(' or ')}`);
        console.log(`   URL: ${req.method} ${req.url}`);
        return res.status(403).send({
          success: false,
          message: `Access denied. Required level: ${allowedLevels.join(' or ')}`
        });
      }

      console.log(`Auth granted: ${req.user.username} [${req.user.level}]`);

    } catch (error) {
      console.error('Auth error:', error);
      return res.status(500).send({
        success: false,
        message: 'Authorization error',
        error: error.message
      });
    }
  };
};

/**
 * Optional Auth middleware
 * Attaches user if token is valid but doesn't fail if no token
 */
export const optionalAuth = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      
      if (user && user.isActive) {
        req.user = user;
      }
    }
  } catch (error) {
    // Silently fail - this is optional auth
  }
};
