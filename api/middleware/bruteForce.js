import LoginAttempt from "../models/LoginAttempt.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("BRUTE_FORCE");

export const bruteForceProtection = async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress;
  const { username, email } = req.body;
  const identifier = username || email;

  if (!identifier) {
    return res.status(400).send({
      success: false,
      message: "Username or email is required",
    });
  }

  try {
    const isBlocked = await LoginAttempt.isBlocked(ip, identifier, 5);

    if (isBlocked) {
      const remainingMinutes = await LoginAttempt.getBlockTimeRemaining(
        ip,
        identifier,
        15
      );

      logger.warn("Brute force protection activated", {
        ip,
        identifier,
        remainingMinutes,
      });

      return res.status(429).send({
        success: false,
        message: `Too many failed login attempts. Please try again in ${remainingMinutes} minute(s).`,
        error: "Too Many Failed Attempts",
        remainingMinutes,
        retryAfter: remainingMinutes * 60,
      });
    }

    const failedAttempts = await LoginAttempt.getRecentFailedAttempts(
      ip,
      identifier,
      15
    );
    const remainingAttempts = Math.max(0, 5 - failedAttempts);

    if (failedAttempts > 0) {
      logger.debug("Login attempt detected", {
        ip,
        identifier,
        failedAttempts,
        remainingAttempts,
      });
    }

    req.bruteForceData = {
      ip,
      identifier,
      remainingAttempts,
    };
  } catch (error) {
    logger.error("Brute force protection error", error);
  }
};

export const recordLoginAttempt = async (req, success) => {
  if (!req.bruteForceData) return;

  const { ip, identifier } = req.bruteForceData;

  try {
    await LoginAttempt.recordAttempt(ip, identifier, success);

    if (success) {
      await LoginAttempt.clearAttempts(ip, identifier);
      logger.info("Successful login - brute force records cleared", {
        ip,
        identifier,
      });
    } else {
      const failedAttempts = await LoginAttempt.getRecentFailedAttempts(
        ip,
        identifier,
        15
      );
      const remainingAttempts = Math.max(0, 5 - failedAttempts);

      logger.warn("Failed login attempt recorded", {
        ip,
        identifier,
        failedAttempts,
        remainingAttempts,
      });
    }
  } catch (error) {
    logger.error("Error recording login attempt", error);
  }
};
