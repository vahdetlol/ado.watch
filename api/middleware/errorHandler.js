function errorHandler(ctx, next) {
  try {
    return next();
  } catch (err) {
    console.error("\n[ERROR]:", err);

  // Multer errors
    if (err.name === 'MulterError') {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return ctx.status(400).json({
          success: false,
          message: "File size is too much (max 2 GB)"
        });
      }
      return ctx.status(400).json({
        success: false,
        message: err.message
      });
    }

  // MongoDB validation errors
    if (err.name === 'ValidationError') {
      return ctx.status(400).json({
        success: false,
        message: "Invalid data",
        errors: Object.values(err.errors).map(e => e.message)
      });
    }

  // MongoDB duplicate key errors
    if (err.code === 11000) {
      return ctx.status(400).json({
        success: false,
        message: "This entry already exists"
      });
    }

  // General server error
    ctx.status(err.status || 500).json({
      success: false,
      message: err.message || "Server error"
    });
  }
}

export default errorHandler;
