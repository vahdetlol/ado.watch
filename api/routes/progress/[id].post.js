import { wsManager } from "../../utils/websocketManager.js";
import { Route } from "owebjs";

export default class extends Route {
  method = "POST";

  schema = {
    params: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string" },
      },
    },
    body: {
      type: "object",
      required: ["progress"],
      properties: {
        progress: { type: "number", minimum: 0, maximum: 100 },
        status: { type: "string" },
        result: { type: "object" },
        error: { type: "string" },
      },
    },
  };

  async handle(req, res) {
    const { id: pid } = req.params;
    const { progress, status, result, error, detailedProgress } = req.body;

    console.log(
      `[Progress] Received update - PID: ${pid}, Progress: ${progress}%, Status: ${status}`
    );

    try {
      if (status === "completed") {
        wsManager.completeProgress(pid, result);
      } else if (status === "failed") {
        wsManager.failProgress(pid, { message: error });
      } else {
        wsManager.updateProgress(pid, progress, status, detailedProgress);
      }

      return res.status(200).send({
        success: true,
        message: "Progress updated",
      });
    } catch (error) {
      console.error("Progress update error:", error);
      return res.status(500).send({
        success: false,
        message: "Failed to update progress",
      });
    }
  }
}
