import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// ES6'da __dirname alternatifi
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Routes
import videoRoutes from './routes/videos.js';
import uploadRoutes from './routes/upload.js';
import categoryRoutes from './routes/categories.js';
import tagRoutes from './routes/tags.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files (thumbnails için)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Bağlantısı
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB'ye bağlanıldı"))
  .catch((err) => console.error("❌ MongoDB bağlantı hatası:", err));

// Routes
app.use('/api/videos', videoRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/tags', tagRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

app.get('/api', (req, res) => {
  res.json('everything is for ado :heart:');
});

// Error Handler (en sonda olmalı)
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'why you are here?' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 API ${PORT} portunda çalışıyor`);
});
 