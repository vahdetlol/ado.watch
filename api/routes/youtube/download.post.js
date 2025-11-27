import { Route } from "owebjs";
import { authenticate, authorize } from "../../middleware/auth.js";
import {
  proxyToVideoServerWithProgress,
  sendProxiedResponse,
} from "../../utils/videoServerProxy.js";
import { generateProcessId } from "../../utils/snowflake.js";

// POST /youtube/download - Proxy to video-server for YouTube download
export default class extends Route {
  async handle(req, reply) {
    await authenticate(req, reply);
    if (reply.sent) return;

    await authorize("admin", "moderator", "uploader")(req, reply);
    if (reply.sent) return;

    try {
      const pid = generateProcessId();

      reply.status(202).send({
        success: true,
        pid: pid,
        message: "Download started. Track progress via WebSocket.",
      });

      proxyToVideoServerWithProgress(
        "/youtube/download",
        {
          method: "POST",
          body: {
            ...req.body,
            _user: {
              _id: req.user._id,
              username: req.user.username,
            },
          },
        },
        req.user._id.toString(),
        pid
      ).catch((error) => {
        console.error("Background YouTube download error:", error);
      });
    } catch (error) {
      console.error("YouTube download proxy error:", error);
      return reply.status(500).send({
        success: false,
        message: "Failed to connect to video server",
        error: error.message,
      });
    }
  }
}
