const rateLimitStore = new Map();

function cleanupExpiredEntries(store, windowMs) {
  const now = Date.now();
  for (const [key, data] of store.entries()) {
    if (now - data.resetTime > windowMs) {
      store.delete(key);
    }
  }
}

export function registerGlobalRateLimit(fastify) {
  const windowMs = 15 * 60 * 1000;
  const max = 100;
  
  setInterval(() => cleanupExpiredEntries(rateLimitStore, windowMs), windowMs);

  fastify.addHook('onRequest', async (request, reply) => {
    const key = request.ip || request.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    
    let record = rateLimitStore.get(key);
    
    if (!record || now > record.resetTime) {
      record = {
        count: 0,
        resetTime: now + windowMs
      };
      rateLimitStore.set(key, record);
    }
    
    record.count++;
    
    const remaining = Math.max(0, max - record.count);
    const resetTime = Math.ceil(record.resetTime / 1000);
    
    reply.header('X-RateLimit-Limit', max);
    reply.header('X-RateLimit-Remaining', remaining);
    reply.header('X-RateLimit-Reset', resetTime);
    
    if (record.count > max) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      reply.header('Retry-After', retryAfter);
      
      reply.code(429).send({
        success: false,
        message: 'Too many requests. Please try again in 15 minutes.',
        error: 'Too Many Requests',
        statusCode: 429,
        retryAfter
      });
    }
  });
}

export function createRateLimiter(options = {}) {
  const {
    windowMs = 15 * 60 * 1000,
    max = 100,
  message = 'Too many requests. Please try again later.',
    statusCode = 429,
    keyGenerator = (request) => request.ip || request.socket?.remoteAddress || 'unknown'
  } = options;

  const store = new Map();
  setInterval(() => cleanupExpiredEntries(store, windowMs), windowMs);

  return async (request, reply) => {
    const key = keyGenerator(request);
    const now = Date.now();
    
    let record = store.get(key);
    
    if (!record || now > record.resetTime) {
      record = {
        count: 0,
        resetTime: now + windowMs
      };
      store.set(key, record);
    }
    
    record.count++;
    
    const remaining = Math.max(0, max - record.count);
    const resetTime = Math.ceil(record.resetTime / 1000);
    
    reply.header('X-RateLimit-Limit', max);
    reply.header('X-RateLimit-Remaining', remaining);
    reply.header('X-RateLimit-Reset', resetTime);
    
    if (record.count > max) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      reply.header('Retry-After', retryAfter);
      
      reply.code(statusCode).send({
        success: false,
        message,
        error: 'Too Many Requests',
        statusCode,
        retryAfter
      });
    }
  };
}

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts. Please try again in 15 minutes.'
});

export const uploadRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Upload limit exceeded. Please try again in 1 hour.',
  keyGenerator: (request) => {
    return request.user?._id || request.ip || 'unknown';
  }
});

export const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'API request limit exceeded. Please try again in 15 minutes.',
  keyGenerator: (request) => {
    return request.user?._id || request.ip || 'unknown';
  }
});

