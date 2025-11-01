import fastifyHelmet from '@fastify/helmet';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';

/**
 * Security middleware configuration
 * Implements various security best practices
 */
export async function registerSecurityMiddleware(app) {
  // Register Fastify Helmet with custom configuration
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "data:"],
        connectSrc: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false, // Disable for better compatibility
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    frameguard: {
      action: 'sameorigin'
    },
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin'
    }
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
      // Protect against duplicate query parameters
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

  console.log(' Security middleware registered');
}
