import { Route } from "owebjs";
import { authenticate } from "../../middleware/auth.js";
import { proxyMultipartToVideoServerWithProgress } from "../../utils/videoServerProxy.js";
import { generateProcessId } from "../../utils/snowflake.js";

// POST /upload - Proxy to video-server for single video upload
export default class extends Route {
  async handle(req, reply) {
    await authenticate(req, reply);
    if (reply.sent) return;

    try {
      const pid = generateProcessId();

      reply.status(202).send({
        success: true,
        pid: pid,
        message: "Upload started. Track progress via WebSocket.",
      });

      const VIDEO_SERVER_URL =
        process.env.VIDEO_SERVER_URL || "http://127.0.0.1:5001";
      const url = `${VIDEO_SERVER_URL}/upload`;

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
        console.error("Background upload error:", error);
      });
    } catch (error) {
      console.error("Upload proxy error:", error);
      return reply.status(500).send({
        success: false,
        message: "Failed to connect to video server",
        error: error.message,
      });
    }
  }
}
