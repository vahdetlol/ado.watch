const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const currentLevel =
  LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ??
  (process.env.NODE_ENV === "production" ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG);

class Logger {
  constructor(module = "VIDEO_SERVER") {
    this.module = module;
  }

  _formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : "";
    return `[${timestamp}] [${level}] [${this.module}] ${message} ${metaStr}`.trim();
  }

  _shouldLog(level) {
    return LOG_LEVELS[level] <= currentLevel;
  }

  error(message, error = null) {
    if (!this._shouldLog("ERROR")) return;

    const meta = error
      ? {
          error: error.message,
          stack:
            process.env.NODE_ENV !== "production" ? error.stack : undefined,
        }
      : {};
    console.error(this._formatMessage("ERROR", message, meta));
  }

  warn(message, meta = {}) {
    if (!this._shouldLog("WARN")) return;
    console.warn(this._formatMessage("WARN", message, meta));
  }

  info(message, meta = {}) {
    if (!this._shouldLog("INFO")) return;
    console.info(this._formatMessage("INFO", message, meta));
  }

  debug(message, meta = {}) {
    if (!this._shouldLog("DEBUG")) return;
    console.log(this._formatMessage("DEBUG", message, meta));
  }

  secureLog(level, message, data = {}) {
    const sensitiveKeys = [
      "password",
      "token",
      "secret",
      "authorization",
      "cookie",
    ];
    const sanitized = { ...data };

    for (const key in sanitized) {
      if (sensitiveKeys.some((k) => key.toLowerCase().includes(k))) {
        sanitized[key] = "[REDACTED]";
      }
    }

    this[level](message, sanitized);
  }
}

export const createLogger = (module) => new Logger(module);

// Defaut logger
export const logger = new Logger("VIDEO_SERVER");
