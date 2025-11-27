import { Route } from "owebjs";
import { authenticate } from "../../middleware/auth.js";
import { generateProcessId } from "../../utils/snowflake.js";
import { createLogger } from "../../utils/logger.js";

const logger = createLogger("UPLOAD_PROXY");

// POST /upload/multiple - Proxy to video-server for multiple video upload
export default class extends Route {
  async handle(req, reply) {
    await authenticate(req, reply);
    if (reply.sent) return;

    try {
      const pid = generateProcessId();

      reply.status(202).send({
        success: true,
        pid: pid,
        message: "Multiple upload started. Track progress via WebSocket.",
      });

      const VIDEO_SERVER_URL =
        process.env.VIDEO_SERVER_URL || "http://127.0.0.1:5001";
      const url = `${VIDEO_SERVER_URL}/upload/multiple`;

      fetch(url, {
        method: "POST",
        headers: {
          ...req.headers,
          "x-user-id": req.user._id.toString(),
          "x-user-username": req.user.username,
          "x-process-id": pid,
          "x-progress-callback": `${
            process.env.API_URL || "http://127.0.0.1:5000"
          }/progress/${pid}`,
        },
        body: req.raw,
        duplex: "half",
      }).catch((error) => {
        logger.error("Background multiple upload error:", error);
      });
    } catch (error) {
      logger.error("Upload proxy error:", error);
      return reply.status(500).send({
        success: false,
        message: "Failed to connect to video server",
        error:
          process.env.NODE_ENV === "production" ? undefined : error.message,
      });
    }
  }
}
