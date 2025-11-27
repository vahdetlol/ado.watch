import fastifyHelmet from "@fastify/helmet";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("SECURITY");

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
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Inline styles için gerekli
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "data:"],
        mediaSrc: ["'self'", "blob:", "https:"],
        connectSrc: ["'self'", "ws:", "wss:"], // WebSocket için
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests:
          process.env.NODE_ENV === "production" ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: {
      maxAge: 31536000, // 1 yıl
      includeSubDomains: true,
      preload: true,
    },
    frameguard: {
      action: "deny", // Clickjacking koruması
    },
    noSniff: true, // MIME type sniffing koruması
    referrerPolicy: {
      policy: "strict-origin-when-cross-origin",
    },
    xssFilter: true,
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

  logger.info("Security middleware registered");
}
