import LoginAttempt from '../models/LoginAttempt.js';

export const bruteForceProtection = async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress;
  const { username, email } = req.body;
  const identifier = username || email;

  if (!identifier) {
    return res.status(400).send({
      success: false,
      message: 'Username or email is required'
    });
  }

  try {
    const isBlocked = await LoginAttempt.isBlocked(ip, identifier, 5);

    if (isBlocked) {
      const remainingMinutes = await LoginAttempt.getBlockTimeRemaining(ip, identifier, 15);
      
  console.log(`🚫 Brute force protection activated`);
  console.log(`   IP: ${ip}`);
  console.log(`   User: ${identifier}`);
  console.log(`   Time remaining: ${remainingMinutes} minute(s)`);

      return res.status(429).send({
        success: false,
        message: `Too many failed login attempts. Please try again in ${remainingMinutes} minute(s).`,
        error: 'Too Many Failed Attempts',
        remainingMinutes,
        retryAfter: remainingMinutes * 60
      });
    }

    const failedAttempts = await LoginAttempt.getRecentFailedAttempts(ip, identifier, 15);
    const remainingAttempts = Math.max(0, 5 - failedAttempts);

    if (failedAttempts > 0) {
      console.log(`⚠️  Login attempt detected`);
      console.log(`   IP: ${ip}`);
      console.log(`   User: ${identifier}`);
      console.log(`   Failed attempts: ${failedAttempts}/5`);
      console.log(`   Attempts remaining: ${remainingAttempts}`);
    }

    req.bruteForceData = {
      ip,
      identifier,
      remainingAttempts
    };

  } catch (error) {
    console.error('Brute force protection error:', error);
  }
};

export const recordLoginAttempt = async (req, success) => {
  if (!req.bruteForceData) return;

  const { ip, identifier } = req.bruteForceData;

  try {
    await LoginAttempt.recordAttempt(ip, identifier, success);

    if (success) {
      await LoginAttempt.clearAttempts(ip, identifier);
      console.log(` Successful login - brute force records cleared`);
      console.log(`   IP: ${ip}`);
      console.log(`   User: ${identifier}`);
    } else {
      const failedAttempts = await LoginAttempt.getRecentFailedAttempts(ip, identifier, 15);
      const remainingAttempts = Math.max(0, 5 - failedAttempts);
      
      console.log(` Failed login attempt recorded`);
      console.log(`   IP: ${ip}`);
      console.log(`   User: ${identifier}`);
      console.log(`   Total failed: ${failedAttempts}/5`);
      console.log(`   Attempts remaining: ${remainingAttempts}`);
    }
  } catch (error) {
    console.error('Error recording login attempt:', error);
  }
};
