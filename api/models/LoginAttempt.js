import mongoose from 'mongoose';

const loginAttemptSchema = new mongoose.Schema({
  ip: {
    type: String,
    required: true,
    index: true
  },
  username: {
    type: String,
    required: true
  },
  success: {
    type: Boolean,
    default: false
  },
  attemptTime: {
    type: Date,
    default: Date.now,
    expires: 900
  }
});

loginAttemptSchema.index({ ip: 1, attemptTime: 1 });
loginAttemptSchema.index({ username: 1, attemptTime: 1 });

loginAttemptSchema.statics.recordAttempt = async function(ip, username, success) {
  return await this.create({
    ip,
    username: username.toLowerCase(),
    success,
    attemptTime: new Date()
  });
};

loginAttemptSchema.statics.getRecentFailedAttempts = async function(ip, username, timeWindowMinutes = 15) {
  const timeLimit = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
  
  return await this.countDocuments({
    $or: [
      { ip, success: false },
      { username: username.toLowerCase(), success: false }
    ],
    attemptTime: { $gte: timeLimit }
  });
};

loginAttemptSchema.statics.isBlocked = async function(ip, username, maxAttempts = 5) {
  const failedAttempts = await this.getRecentFailedAttempts(ip, username);
  return failedAttempts >= maxAttempts;
};

loginAttemptSchema.statics.clearAttempts = async function(ip, username) {
  await this.deleteMany({
    $or: [
      { ip },
      { username: username.toLowerCase() }
    ]
  });
};

loginAttemptSchema.statics.getBlockTimeRemaining = async function(ip, username, timeWindowMinutes = 15) {
  const timeLimit = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
  
  const oldestAttempt = await this.findOne({
    $or: [
      { ip, success: false },
      { username: username.toLowerCase(), success: false }
    ],
    attemptTime: { $gte: timeLimit }
  }).sort({ attemptTime: 1 });

  if (!oldestAttempt) {
    return 0;
  }

  const blockUntil = new Date(oldestAttempt.attemptTime.getTime() + timeWindowMinutes * 60 * 1000);
  const remainingMs = blockUntil - Date.now();
  
  return Math.max(0, Math.ceil(remainingMs / 1000 / 60));
};

const LoginAttempt = mongoose.model('LoginAttempt', loginAttemptSchema);

export default LoginAttempt;
