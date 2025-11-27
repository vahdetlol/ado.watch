import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("AUTH");

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
export const authenticate = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logger.warn("Authentication failed: No token provided", {
        url: `${req.method} ${req.url}`,
        ip: req.ip || req.socket.remoteAddress,
      });
      return res.status(401).send({
        success: false,
        message: "No token provided. Please login.",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId);

    if (!user) {
      logger.warn("Authentication failed: User not found", {
        userId: decoded.userId,
        url: `${req.method} ${req.url}`,
      });
      return res.status(401).send({
        success: false,
        message: "User not found",
      });
    }

    if (!user.isActive) {
      logger.warn("Authentication failed: Account deactivated", {
        username: user.username,
        email: user.email,
        url: `${req.method} ${req.url}`,
      });
      return res.status(403).send({
        success: false,
        message: "Account is deactivated",
      });
    }

    req.user = user;
    logger.debug("User authenticated", {
      username: user.username,
      level: user.level,
    });

    return;
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      logger.warn("Authentication failed: Invalid token", {
        url: `${req.method} ${req.url}`,
        error: error.message,
      });
      return res.status(401).send({
        success: false,
        message: "Invalid token",
      });
    }

    if (error.name === "TokenExpiredError") {
      logger.warn("Authentication failed: Token expired", {
        url: `${req.method} ${req.url}`,
        expiredAt: error.expiredAt,
      });
      return res.status(401).send({
        success: false,
        message: "Token expired",
      });
    }

    logger.error("Authentication error", error);
    return res.status(500).send({
      success: false,
      message: "Authentication error",
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
        logger.warn("Authorization failed: User not authenticated", {
          url: `${req.method} ${req.url}`,
        });
        return res.status(401).send({
          success: false,
          message: "Please log in first",
        });
      }

      if (!allowedLevels.includes(req.user.level)) {
        logger.warn("Authorization failed: Insufficient permissions", {
          username: req.user.username,
          userLevel: req.user.level,
          required: allowedLevels.join(" or "),
          url: `${req.method} ${req.url}`,
        });
        return res.status(403).send({
          success: false,
          message: `Access denied. Required level: ${allowedLevels.join(
            " or "
          )}`,
        });
      }

      logger.debug("Authorization granted", {
        username: req.user.username,
        level: req.user.level,
      });
      return;
    } catch (error) {
      logger.error("Authorization error", error);
      return res.status(500).send({
        success: false,
        message: "Authorization error",
      });
    }
  };
};

/**
 * Optional authentication middleware
 * Attaches user if token is valid but doesn't fail if no token
 */
export const optionalAuth = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);

      if (user && user.isActive) {
        req.user = user;
      }
    }
    return;
  } catch (error) {
    return;
  }
};
