import "dotenv/config";
import Oweb from "owebjs";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fastifyStatic from "@fastify/static";
import fastifyCors from "@fastify/cors";
import { registerGlobalRateLimit } from "./middleware/rateLimiter.js";
import { registerSecurityMiddleware } from "./middleware/security.js";
import { registerXSSProtection } from "./middleware/xss.js";
import { createLogger } from "./utils/logger.js";

const logger = createLogger("SERVER");

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

mongoose
  .connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(() => logger.info("Connected to MongoDB"))
  .catch((err) => {
    logger.error("MongoDB connection error", err);
    process.exit(1);
  });

mongoose.connection.on("disconnected", () => {
  logger.error("MongoDB disconnected! Attempting to reconnect...");
});

mongoose.connection.on("error", (err) => {
  logger.error("MongoDB error", err);
});

const app = new Oweb();
const server = await app.setup();

await server.register(fastifyCors, {
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : [],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
});

// Register security middleware
await registerSecurityMiddleware(server);

// Register XSS protection
registerXSSProtection(server);

// Register rate limiting
registerGlobalRateLimit(server);

// Static files (uploaded videos and thumbnails)
await server.register(fastifyStatic, {
  root: path.join(__dirname, "uploads"),
  prefix: "/uploads/",
});

// Load routes
await server.loadRoutes({
  directory: "routes",
  hmr: {
    enabled: process.env.NODE_ENV !== "production",
  },
});

server.setInternalErrorHandler((req, res, error) => {
  // Sadece production'da hassas bilgileri logla
  if (process.env.NODE_ENV === "production") {
    logger.error("Internal server error", {
      message: error.message,
      stack: error.stack,
    });
  } else {
    logger.error("Internal server error", error);
  }

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

  // Geçersiz status code kontrolü
  const statusCode =
    error.status >= 100 && error.status < 600 ? error.status : 500;

  const message =
    process.env.NODE_ENV === "production"
      ? "Internal server error"
      : error.message || "Server error";

  res.status(statusCode).send({
    success: false,
    message,
  });
});

// Start server
const { err, address } = await server.start({
  port: parseInt(process.env.PORT) || 5001,
  host: "127.0.0.1",
});

if (err) {
  logger.error("Server start error", err);
  process.exit(1);
}

logger.info(`Video server is working on ${address}`);
