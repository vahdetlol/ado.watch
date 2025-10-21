require('dotenv').config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

// Routes
const videoRoutes = require("./routes/videos");
const uploadRoutes = require("./routes/upload");
const categoryRoutes = require("./routes/categories");
const tagRoutes = require("./routes/tags");
const errorHandler = require("./middleware/errorHandler");

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
 