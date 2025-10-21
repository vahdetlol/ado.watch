require('dotenv').config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

// Routes
const streamRoutes = require("./routes/stream");
const youtubeRoutes = require("./routes/youtube");
const uploadRoutes = require("./routes/upload");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files (uploaded videos and thumbnails)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Bağlantısı
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB'ye bağlanıldı (Video Server)"))
  .catch((err) => console.error("❌ MongoDB bağlantı hatası:", err));

// Routes
app.use('/api/stream', streamRoutes);
app.use('/api/youtube', youtubeRoutes);
app.use('/api/upload', uploadRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'video-server',
    timestamp: new Date() 
  });
});

app.get('/api', (req, res) => {
  res.json({ message: 'Video Server - Download & Stream Service' });
});

// Error Handler (en sonda olmalı)
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 Video Server ${PORT} portunda çalışıyor`);
});
