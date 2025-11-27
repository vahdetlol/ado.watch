import fastifyHelmet from "@fastify/helmet";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("SECURITY");

/**
 * Security middleware configuration for video server
 * Implements various security best practices
 */
export async function registerSecurityMiddleware(app) {
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
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
    const MAX_DEPTH = 10; // Stack overflow koruması

    const sanitizeObject = (obj, depth = 0) => {
      if (!obj || typeof obj !== "object" || depth > MAX_DEPTH) return obj;

      const sanitized = Array.isArray(obj) ? [] : {};

      for (const key in obj) {
        // Remove keys starting with $ or containing .
        if (key.startsWith("$") || key.includes(".")) {
          logger.warn("Potentially malicious input detected", { key });
          continue;
        }

        const value = obj[key];

        if (value && typeof value === "object") {
          sanitized[key] = sanitizeObject(value, depth + 1);
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

  // File upload size protection (additional layer)
  app.addHook("preHandler", async (request, reply) => {
    const contentLength = request.headers["content-length"];
    if (contentLength) {
      const maxSize = 2 * 1024 * 1024 * 1024; // 2 GB
      if (parseInt(contentLength) > maxSize) {
        reply.status(413).send({
          success: false,
          message: "File size too large (max 2 GB)",
        });
      }
    }
  });
}
