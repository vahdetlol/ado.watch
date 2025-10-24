import mongoSanitize from 'express-mongo-sanitize';

/**
 * Security middleware configuration for video server
 * Implements various security best practices
 */
export function registerSecurityMiddleware(app) {
  // Security headers
  app.addHook('onRequest', async (request, reply) => {
    // Content Security Policy
    reply.header('Content-Security-Policy', 
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "media-src 'self' blob:; " +
      "connect-src 'self';"
    );
    
    // X-Content-Type-Options - Prevents MIME type sniffing
    reply.header('X-Content-Type-Options', 'nosniff');
    
    // X-Frame-Options - Clickjacking protection
    reply.header('X-Frame-Options', 'SAMEORIGIN');
    
    // X-XSS-Protection - XSS filter
    reply.header('X-XSS-Protection', '1; mode=block');
    
    // Strict-Transport-Security - Force HTTPS (in production)
    if (process.env.NODE_ENV === 'production') {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    
    // Referrer-Policy - Control referrer information
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions-Policy - Control browser features
    reply.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    // Remove X-Powered-By header
    reply.removeHeader('X-Powered-By');
  });

  // MongoDB injection prevention
  app.addHook('preValidation', async (request, reply) => {
    if (request.body) {
      request.body = mongoSanitize.sanitize(request.body, {
        replaceWith: '_'
      });
    }
    if (request.query) {
      request.query = mongoSanitize.sanitize(request.query, {
        replaceWith: '_'
      });
    }
    if (request.params) {
      request.params = mongoSanitize.sanitize(request.params, {
        replaceWith: '_'
      });
    }
  });

  // HTTP Parameter Pollution protection
  app.addHook('preValidation', async (request, reply) => {
    if (request.query) {
      const cleanQuery = {};
      for (const key in request.query) {
        if (Array.isArray(request.query[key])) {
          // Keep only the last value if there are duplicates
          cleanQuery[key] = request.query[key][request.query[key].length - 1];
        } else {
          cleanQuery[key] = request.query[key];
        }
      }
      request.query = cleanQuery;
    }
  });

  // File upload size protection (additional layer)
  app.addHook('preHandler', async (request, reply) => {
    const contentLength = request.headers['content-length'];
    if (contentLength) {
      const maxSize = 2 * 1024 * 1024 * 1024; // 2 GB
      if (parseInt(contentLength) > maxSize) {
        reply.status(413).send({
          success: false,
          message: 'File size too large (max 2 GB)'
        });
      }
    }
  });
}
