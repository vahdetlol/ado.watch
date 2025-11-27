import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { createLogger } from "./logger.js";

const logger = createLogger("WEBSOCKET");

class WebSocketManager {
  constructor() {
    this.wss = null;
    this.clients = new Map();
    this.progressSessions = new Map();
    this.completedSessions = new Map();
  }

  initialize(server) {
    this.wss = new WebSocketServer({ noServer: true });

    this.wss.on("connection", (ws, request, userId = null) => {
      logger.debug("Client connected (awaiting auth)", { userId });

      ws.userId = userId;
      ws.authenticated = false;

      ws.isAlive = true;
      ws.on("pong", () => {
        ws.isAlive = true;
      });

      ws.on("message", (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleMessage(ws, data);
        } catch (error) {
          logger.error("Error parsing WebSocket message", error);
        }
      });

      ws.on("close", () => {
        if (ws.userId && ws.authenticated) {
          logger.debug("Client disconnected", { userId: ws.userId });
          const userClients = this.clients.get(ws.userId);
          if (userClients) {
            userClients.delete(ws);
            if (userClients.size === 0) {
              this.clients.delete(ws.userId);
            }
          }
        } else {
          logger.debug("Unauthenticated client disconnected");
        }
      });

      ws.on("error", (error) => {
        logger.error("WebSocket connection error", error);
      });
    });

    const heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          logger.debug("Terminating inactive WebSocket connection");
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 20000);
    heartbeatInterval.unref(); // Sunucu kapanırken engel olmaz

    this.wss.on("close", () => {
      clearInterval(heartbeatInterval);
      logger.info("WebSocket server closed");
    });

    return this.wss;
  }

  handleMessage(ws, data) {
    switch (data.op) {
      case 2:
        if (!ws.authenticated) {
          this.sendToClient(ws, {
            op: 1,
            d: { authenticated: false, message: "Not authenticated" },
          });
          return;
        }
        this.sendToClient(ws, {
          op: 3,
          d: { message: "Ado will live forever on our hearts" },
        });
        break;
      case 4:
        try {
          if (!data.d || !data.d.token) {
            this.sendToClient(ws, {
              op: 1,
              d: {
                authenticated: false,
                message: "Token required",
              },
            });
            ws.close();
            return;
          }

          if (typeof data.d.token !== "string" || data.d.token.length > 1000) {
            this.sendToClient(ws, {
              op: 1,
              d: {
                authenticated: false,
                message: "Invalid token format",
              },
            });
            ws.close();
            return;
          }

          const decoded = jwt.verify(data.d.token, process.env.JWT_SECRET);

          if (!decoded.userId || typeof decoded.userId !== "string") {
            throw new Error("Invalid token payload");
          }

          const userId = decoded.userId;

          ws.userId = userId;
          ws.authenticated = true;

          if (!this.clients.has(userId)) {
            this.clients.set(userId, new Set());
          }
          this.clients.get(userId).add(ws);

          logger.info("Client authenticated", { userId });

          this.sendToClient(ws, {
            op: 1,
            d: {
              authenticated: true,
              message: "Connected to WebSocket",
              activeSessions: this.getAllActiveSessions(),
              recentCompleted: this.getAllRecentCompleted(),
            },
          });
        } catch (error) {
          logger.error("WebSocket authentication failed", {
            error: error.message,
          });
          this.sendToClient(ws, {
            op: 1,
            d: {
              authenticated: false,
              message: "Authentication failed",
            },
          });
          ws.close();
        }
        break;
      case 6:
        if (!ws.authenticated) {
          this.sendToClient(ws, {
            op: 1,
            d: { authenticated: false, message: "Not authenticated" },
          });
          return;
        }
        this.sendToClient(ws, {
          op: 7,
          d: {
            activeSessions: this.getAllActiveSessions(),
            recentCompleted: this.getAllRecentCompleted(),
          },
        });
        break;
      default:
        logger.warn("Unknown WebSocket operation", { op: data.op });
    }
  }

  sendToClient(ws, data) {
    if (ws.readyState === 1) {
      // OPEN
      ws.send(JSON.stringify(data));
    }
  }

  sendToUser(userId, data) {
    const userClients = this.clients.get(userId);
    if (userClients) {
      userClients.forEach((ws) => {
        this.sendToClient(ws, data);
      });
    }
  }

  broadcast(data) {
    this.wss.clients.forEach((ws) => {
      this.sendToClient(ws, data);
    });
  }

  createProgressSession(userId, pid) {
    this.progressSessions.set(pid, {
      userId,
      progress: 0,
      status: "started",
      createdAt: new Date().toISOString(),
      history: [],
      detailedProgress: null,
    });

    this.broadcast({
      op: 5,
      d: {
        pid,
        userId,
        progress: 0,
        status: "started",
        timestamp: new Date().toISOString(),
      },
    });
  }

  updateProgress(
    pid,
    progress,
    status = "processing",
    detailedProgress = null,
    userId = null
  ) {
    let session = this.progressSessions.get(pid);

    if (!session && userId) {
      logger.info("Auto-creating missing progress session", { pid, userId });
      this.createProgressSession(userId, pid);
      session = this.progressSessions.get(pid);
    }

    if (session) {
      session.progress = progress;
      session.status = status;
      session.lastUpdate = new Date().toISOString();

      if (detailedProgress) {
        session.detailedProgress = detailedProgress;
      }

      session.history.push({
        progress,
        status,
        timestamp: session.lastUpdate,
        detailedProgress,
      });

      this.broadcast({
        op: 5,
        d: {
          pid,
          userId: session.userId,
          progress,
          status,
          detailedProgress,
          timestamp: session.lastUpdate,
        },
      });
    } else {
      logger.debug("Progress update skipped - no session", { pid });
    }
  }

  completeProgress(pid, result = null) {
    const session = this.progressSessions.get(pid);
    if (session) {
      const completedAt = new Date().toISOString();

      this.broadcast({
        op: 5,
        d: {
          pid,
          userId: session.userId,
          progress: 100,
          status: "completed",
          result,
          timestamp: completedAt,
        },
      });

      this.completedSessions.set(pid, {
        userId: session.userId,
        progress: 100,
        status: "completed",
        result,
        completedAt,
        createdAt: session.createdAt,
        history: session.history,
      });

      if (this.completedSessions.size > 100) {
        const firstKey = this.completedSessions.keys().next().value;
        this.completedSessions.delete(firstKey);
      }

      this.progressSessions.delete(pid);
    }
  }

  failProgress(pid, error) {
    const session = this.progressSessions.get(pid);
    if (session) {
      const failedAt = new Date().toISOString();

      this.broadcast({
        op: 5,
        d: {
          pid,
          userId: session.userId,
          progress: session.progress,
          status: "failed",
          error: error.message || "Unknown error",
          timestamp: failedAt,
        },
      });

      this.completedSessions.set(pid, {
        userId: session.userId,
        progress: session.progress,
        status: "failed",
        error: error.message || "Unknown error",
        completedAt: failedAt,
        createdAt: session.createdAt,
        history: session.history,
      });

      if (this.completedSessions.size > 100) {
        const firstKey = this.completedSessions.keys().next().value;
        this.completedSessions.delete(firstKey);
      }

      this.progressSessions.delete(pid);
    }
  }

  getAllActiveSessions() {
    const sessions = [];
    for (const [pid, session] of this.progressSessions.entries()) {
      sessions.push({
        pid,
        userId: session.userId,
        progress: session.progress,
        status: session.status,
        createdAt: session.createdAt,
        lastUpdate: session.lastUpdate,
        detailedProgress: session.detailedProgress || null,
      });
    }
    return sessions;
  }

  getAllRecentCompleted() {
    const sessions = [];
    for (const [pid, session] of this.completedSessions.entries()) {
      sessions.push({
        pid,
        userId: session.userId,
        status: session.status,
        progress: session.progress,
        result: session.result,
        error: session.error,
        completedAt: session.completedAt,
        createdAt: session.createdAt,
      });
    }
    return sessions.slice(-100);
  }

  getActiveSessionsForUser(userId) {
    const sessions = [];
    for (const [pid, session] of this.progressSessions.entries()) {
      if (session.userId === userId) {
        sessions.push({
          pid,
          progress: session.progress,
          status: session.status,
          createdAt: session.createdAt,
          lastUpdate: session.lastUpdate,
          detailedProgress: session.detailedProgress || null,
        });
      }
    }
    return sessions;
  }

  getRecentCompletedForUser(userId) {
    const sessions = [];
    for (const [pid, session] of this.completedSessions.entries()) {
      if (session.userId === userId) {
        sessions.push({
          pid,
          status: session.status,
          progress: session.progress,
          result: session.result,
          error: session.error,
          completedAt: session.completedAt,
          createdAt: session.createdAt,
        });
      }
    }
    return sessions.slice(-10);
  }

  handleUpgrade(request, socket, head) {
    try {
      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.wss.emit("connection", ws, request, null);
      });
    } catch (error) {
      logger.error("WebSocket upgrade failed", error);
      socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
      socket.destroy();
    }
  }

  handleVideoServerUpgrade(request, socket, head) {
    try {
      this.wss.handleUpgrade(request, socket, head, (ws) => {
        logger.info("Video server connected via WebSocket");

        ws.isVideoServer = true;
        ws.isAlive = true;

        ws.on("pong", () => {
          ws.isAlive = true;
        });

        ws.on("message", (message) => {
          try {
            const data = JSON.parse(message.toString());
            this.handleVideoServerMessage(data);
          } catch (error) {
            logger.error("Video server message parse error", error);
          }
        });

        ws.on("close", () => {
          logger.info("Video server disconnected");
        });

        ws.on("error", (error) => {
          logger.error("Video server WebSocket error", error);
        });

        ws.send(
          JSON.stringify({
            type: "connected",
            message: "Video server WebSocket connected",
          })
        );
      });
    } catch (error) {
      logger.error("Video server WebSocket upgrade failed", error);
      socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
      socket.destroy();
    }
  }

  handleVideoServerMessage(data) {
    const {
      type,
      pid,
      userId,
      progress,
      status,
      detailedProgress,
      result,
      error,
    } = data;

    logger.debug("Video server message received", { type, pid });

    switch (type) {
      case "progress":
        this.updateProgress(pid, progress, status, detailedProgress, userId);
        break;
      case "complete":
        this.completeProgress(pid, result);
        break;
      case "error":
        this.failProgress(pid, { message: error });
        break;
      default:
        logger.warn("Unknown video server message type", { type });
    }
  }
}

export const wsManager = new WebSocketManager();
