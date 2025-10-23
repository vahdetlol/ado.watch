import 'dotenv/config';
import Oweb from 'owebjs';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import fastifyStatic from '@fastify/static';
import cors from '@fastify/cors';
import { registerGlobalRateLimit } from './middleware/rateLimiter.js';
import { registerSecurityMiddleware } from './middleware/security.js';
import { registerXSSProtection } from './middleware/xss.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Create and setup the app
const app = await new Oweb().setup();

// Enable CORS
await app.register(cors, {
  origin: '*', // Allow all origins (be more specific in production)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
});

// Register security middleware
await registerSecurityMiddleware(app);

// Register XSS protection
registerXSSProtection(app);

// Register rate limiting
registerGlobalRateLimit(app);

// Use Fastify plugin for serving static files
await app.register(fastifyStatic, {
  root: path.join(__dirname, 'uploads'),
  prefix: '/uploads/',
});

// Load routes from directory
await app.loadRoutes({
  directory: 'routes',
  hmr: {
    enabled: true,
  },
});

// Error Handler
app.setInternalErrorHandler((req, res, error) => {
  console.error("\n[ERROR]:", error);

  // Multer errors
  if (error.name === 'MulterError') {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).send({
        success: false,
        message: "File size is too much (max 2 GB)"
      });
    }
    return res.status(400).send({
      success: false,
      message: error.message
    });
  }

  // MongoDB validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).send({
      success: false,
      message: "Invalid data",
      errors: Object.values(error.errors).map(e => e.message)
    });
  }

  // MongoDB duplicate key errors
  if (error.code === 11000) {
    return res.status(400).send({
      success: false,
      message: "This entry already exists"
    });
  }

  // General server error
  res.status(error.status || 500).send({
    success: false,
    message: error.message || "Server error"
  });
});

const PORT = process.env.PORT || 5000;
await app.start({ port: PORT });
console.log(` API is working on http://127.0.0.1:${PORT} `);
 