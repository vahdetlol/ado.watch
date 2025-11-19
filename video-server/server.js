import "dotenv/config";
import { Oweb } from "owebjs";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fastifyStatic from "@fastify/static";
import fastifyCors from "@fastify/cors";
import { registerGlobalRateLimit } from "./middleware/rateLimiter.js";
import { registerSecurityMiddleware } from "./middleware/security.js";
import { registerXSSProtection } from "./middleware/xss.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

mongoose.connection.on("disconnected", () => {
  console.error("MongoDB disconnected! Attempting to reconnect...");
});

mongoose.connection.on("error", (err) => {
  console.error("MongoDB error:", err);
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

// Start server
const { err, address } = await server.start({
  port: parseInt(process.env.PORT) || 5001,
  host: "127.0.0.1",
});

if (err) {
  console.error(" Server start error:", err);
  process.exit(1);
}

console.log(`Video server is working on ${address}`);
