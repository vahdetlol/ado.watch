import fastifyHelmet from "@fastify/helmet";

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
        mediaSrc: ["'self'", "blob:", "https:"],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    frameguard: {
      action: "sameorigin",
    },
    referrerPolicy: {
      policy: "strict-origin-when-cross-origin",
    },
  });

  // MongoDB injection prevention
  app.addHook("preValidation", async (request, reply) => {
    const sanitizeObject = (obj) => {
      if (!obj || typeof obj !== "object") return obj;

      const sanitized = Array.isArray(obj) ? [] : {};

      for (const key in obj) {
        // Remove keys starting with $ or containing .
        if (key.startsWith("$") || key.includes(".")) {
          continue;
        }

        const value = obj[key];

        if (value && typeof value === "object") {
          sanitized[key] = sanitizeObject(value);
        } else {
          sanitized[key] = value;
        }
      }

      return sanitized;
    };

    if (request.body) {
      request.body = sanitizeObject(request.body);
    }
    if (request.query) {
      request.query = sanitizeObject(request.query);
    }
    if (request.params) {
      request.params = sanitizeObject(request.params);
    }
  });

  // HTTP Parameter Pollution protection
  app.addHook("preValidation", async (request, reply) => {
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

  console.log("Security middleware registered");
}
