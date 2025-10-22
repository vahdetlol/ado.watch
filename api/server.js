import 'dotenv/config';
import Oweb from 'owebjs';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import fastifyStatic from '@fastify/static';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// MongoDB Bağlantısı
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB'ye bağlanıldı"))
  .catch((err) => console.error("❌ MongoDB bağlantı hatası:", err));

// Create and setup the app
const app = await new Oweb().setup();

// Static files için Fastify plugin kullan
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

  // Multer hataları
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

  // MongoDB validation hataları
  if (error.name === 'ValidationError') {
    return res.status(400).send({
      success: false,
      message: "Invalid data",
      errors: Object.values(error.errors).map(e => e.message)
    });
  }

  // MongoDB duplicate key hataları
  if (error.code === 11000) {
    return res.status(400).send({
      success: false,
      message: "This entry already exists"
    });
  }

  // Genel sunucu hatası
  res.status(error.status || 500).send({
    success: false,
    message: error.message || "Server error"
  });
});

const PORT = process.env.PORT || 5000;
await app.start({ port: PORT });
console.log(`🚀 API ${PORT} portunda çalışıyor - owebjs ile`);
 