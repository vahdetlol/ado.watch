function errorHandler(err, req, res, next) {
  console.error("\n[ERROR]:", err);

  // Multer hataları
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: "File size is too much (max 2 GB)"
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }

  // MongoDB validation hataları
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: "Invalid data",
      errors: Object.values(err.errors).map(e => e.message)
    });
  }

  // MongoDB duplicate key hataları
  if (err.code === 11000) {
    return res.status(400).json({
      success: false,
      message: "This entry already exists"
    });
  }

  // Genel sunucu hatası
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Server error"
  });
}

module.exports = errorHandler;
