import WebSocket from "ws";

class WebSocketProgressClient {
  constructor() {
    this.ws = null;
    this.reconnectTimer = null;
    this.isConnecting = false;
    this.messageQueue = [];
    this.API_WS_URL =
      (process.env.API_SERVER_URL || "http://127.0.0.1:5000").replace(
        "http",
        "ws"
      ) + "/ws/video-server";
  }

  connect() {
    if (
      this.isConnecting ||
      (this.ws && this.ws.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    this.isConnecting = true;
    console.log("[WS Client] Connecting to:", this.API_WS_URL);

    try {
      this.ws = new WebSocket(this.API_WS_URL);

      this.ws.on("open", () => {
        console.log("[WS Client] Connected to API server");
        this.isConnecting = false;

        while (this.messageQueue.length > 0) {
          const msg = this.messageQueue.shift();
          this.send(msg);
        }

        this.pingInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.ping();
          }
        }, 30000);
      });

      this.ws.on("ping", () => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.pong();
        }
      });

      this.ws.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          console.log("[WS Client] Received:", msg);
        } catch (error) {
          console.error("[WS Client] Message parse error:", error);
        }
      });

      this.ws.on("close", () => {
        console.log("[WS Client] Connection closed, reconnecting in 3s...");
        this.isConnecting = false;

        if (this.pingInterval) {
          clearInterval(this.pingInterval);
          this.pingInterval = null;
        }

        if (!this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
          }, 3000);
        }
      });

      this.ws.on("error", (error) => {
        console.error("[WS Client] Error:", error.message);
        this.isConnecting = false;
      });
    } catch (error) {
      console.error("[WS Client] Connection error:", error);
      this.isConnecting = false;
    }
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.messageQueue.push(message);
      if (!this.isConnecting) {
        this.connect();
      }
    }
  }

  sendProgress(pid, userId, progress, status, detailedProgress = null) {
    this.send({
      type: "progress",
      pid,
      userId,
      progress: Math.min(100, Math.max(0, progress)),
      status,
      detailedProgress,
      timestamp: new Date().toISOString(),
    });
  }

  sendComplete(pid, userId, result = null) {
    this.send({
      type: "complete",
      pid,
      userId,
      progress: 100,
      status: "completed",
      result,
      timestamp: new Date().toISOString(),
    });
  }

  sendError(pid, userId, error) {
    this.send({
      type: "error",
      pid,
      userId,
      status: "failed",
      error: error.message || "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const wsClient = new WebSocketProgressClient();

wsClient.connect();
