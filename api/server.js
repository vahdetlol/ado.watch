import "dotenv/config";
import Oweb from "owebjs";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import fastifyStatic from "@fastify/static";
import fastifyCors from "@fastify/cors";
import { registerGlobalRateLimit } from "./middleware/rateLimiter.js";
import { registerSecurityMiddleware } from "./middleware/security.js";
import { registerXSSProtection } from "./middleware/xss.js";
import { wsManager } from "./utils/websocketManager.js";
import { validateEnv, getEnvInfo } from "./utils/validateEnv.js";
import { createLogger } from "./utils/logger.js";

const logger = createLogger("SERVER");
try {
  validateEnv();
} catch (error) {
  console.error("❌ Environment validation failed:", error.message);
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// MongoDB connection with better error handling
const connectToMongoDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    logger.info("Connected to MongoDB");
  } catch (err) {
    logger.error("MongoDB connection failed", err);
    process.exit(1);
  }
};

await connectToMongoDB();

mongoose.connection.on("disconnected", () => {
  logger.warn("MongoDB disconnected! Attempting to reconnect...");
});

mongoose.connection.on("reconnected", () => {
  logger.info("MongoDB reconnected successfully");
});

mongoose.connection.on("error", (err) => {
  logger.error("MongoDB error", err);
});

// Create and setup the app
const app = await new Oweb().setup();

// Enable CORS
await app.register(fastifyCors, {
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : [],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
});

// Register security middleware
await registerSecurityMiddleware(app);

// Register XSS protection
registerXSSProtection(app);

// Register rate limiting
registerGlobalRateLimit(app);

// Use Fastify plugin for serving static files
await app.register(fastifyStatic, {
  root: path.join(__dirname, "uploads"),
  prefix: "/uploads/",
});

// Load routes from directory
await app.loadRoutes({
  directory: "routes",
  hmr: {
    enabled: true,
  },
});

// Error Handler
app.setInternalErrorHandler((req, res, error) => {
  // Sadece production'da hassas bilgileri logla
  if (process.env.NODE_ENV === "production") {
    logger.error("Internal server error", {
      message: error.message,
      stack: error.stack,
    });
  } else {
    logger.error("Internal server error", error);
  }

  // MongoDB validation errors
  if (error.name === "ValidationError") {
    return res.status(400).send({
      success: false,
      message: "Invalid data",
      errors:
        process.env.NODE_ENV === "production"
          ? ["Validation failed"]
          : Object.values(error.errors).map((e) => e.message),
    });
  }

  // MongoDB duplicate key errors
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0] || "field";
    return res.status(409).send({
      success: false,
      message:
        process.env.NODE_ENV === "production"
          ? "This entry already exists"
          : `Duplicate value for ${field}`,
    });
  }

  // JWT errors
  if (
    error.name === "JsonWebTokenError" ||
    error.name === "TokenExpiredError"
  ) {
    return res.status(401).send({
      success: false,
      message: "Authentication failed",
    });
  }

  // Geçersiz status code kontrolü
  const statusCode =
    error.status >= 100 && error.status < 600 ? error.status : 500;

  // Don't expose internal error details in production
  const message =
    process.env.NODE_ENV === "production"
      ? "Internal server error"
      : error.message || "Server error";

  // General server error
  res.status(statusCode).send({
    success: false,
    message,
  });
});

const PORT = process.env.PORT || 5000;
await app.start({ port: PORT });
const server = app.server;
wsManager.initialize(server);

server.on("upgrade", (request, socket, head) => {
  const url = request.url;

  if (url.startsWith("/ws/video-server")) {
    // Video server WebSocket connection (no auth needed)
    wsManager.handleVideoServerUpgrade(request, socket, head);
  } else if (url.startsWith("/ws")) {
    // Client WebSocket connection (auth required)
    wsManager.handleUpgrade(request, socket, head);
  } else {
    socket.destroy();
  }
});

logger.info(`API server started on http://127.0.0.1:${PORT}`);
logger.info(`WebSocket available on ws://127.0.0.1:${PORT}/ws`);
logger.info(`Video Server WebSocket: ws://127.0.0.1:${PORT}/ws/video-server`);
logger.debug("Environment info", getEnvInfo());
