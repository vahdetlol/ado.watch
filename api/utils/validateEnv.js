import { createLogger } from "./logger.js";

const logger = createLogger("ENV_VALIDATOR");

const requiredEnvVars = ["MONGO_URI", "JWT_SECRET", "PORT", "ALLOWED_ORIGINS"];

const optionalEnvVars = ["NODE_ENV", "LOG_LEVEL", "INSTANCE_ID"];
export function validateEnv() {
  const missing = [];
  const warnings = [];

  for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:  - ${missing.join(
        "\n  - "
      )} Please check your .env file.`
    );
  }

  // PORT validation
  if (process.env.PORT) {
    const port = parseInt(process.env.PORT);
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new Error("PORT must be a valid number between 1 and 65535");
    }
  }

  // JWT_SECRET length validation
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    warnings.push(
      "JWT_SECRET should be at least 32 characters long for security"
    );
  }

  // Validate JWT_SECRET strength
  if (process.env.JWT_SECRET) {
    const weakPatterns = [
      "secret",
      "password",
      "12345",
      "qwerty",
      "admin",
      "test",
      "demo",
    ];
    const lowerSecret = process.env.JWT_SECRET.toLowerCase();
    if (weakPatterns.some((pattern) => lowerSecret.includes(pattern))) {
      warnings.push(
        "JWT_SECRET appears to be weak. Use a cryptographically random string."
      );
    }
  }

  // MONGO_URI validation
  if (process.env.MONGO_URI && !process.env.MONGO_URI.startsWith("mongodb")) {
    throw new Error("MONGO_URI must be a valid MongoDB connection string");
  }

  if (process.env.NODE_ENV === "production") {
    if (
      process.env.JWT_SECRET ===
      "your-super-secret-jwt-key-change-this-in-production"
    ) {
      throw new Error("Cannot use default JWT_SECRET in production!");
    }

    if (!process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS === "*") {
      warnings.push(
        "ALLOWED_ORIGINS should be explicitly set in production (not *)"
      );
    }
  }

  // Log warnings
  if (warnings.length > 0) {
    logger.warn("Environment Warnings:");
    warnings.forEach((w) => logger.warn(`  - ${w}`));
  }

  logger.info("Environment variables validated successfully");

  return true;
}

export function getEnvInfo() {
  return {
    nodeEnv: process.env.NODE_ENV || "development",
    port: process.env.PORT || "5000",
    mongoConnected: process.env.MONGO_URI ? "✓" : "✗",
    jwtConfigured: process.env.JWT_SECRET ? "✓" : "✗",
    corsOrigins: process.env.ALLOWED_ORIGINS?.split(",").length || 0,
  };
}
