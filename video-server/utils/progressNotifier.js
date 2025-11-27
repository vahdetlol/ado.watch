import { wsClient } from "./websocketClient.js";
import { createLogger } from "./logger.js";

const logger = createLogger("PROGRESS_NOTIFIER");

export async function sendProgress(
  pid,
  progress,
  status = "processing",
  detailedProgress = null
) {
  if (!pid) {
    logger.warn("No PID provided, skipping progress update");
    return;
  }

  const logDetail = detailedProgress ? JSON.stringify(detailedProgress) : "";
  logger.debug(
    `Sending update - PID: ${pid}, Progress: ${progress}%, Status: ${status} ${logDetail}`
  );

  wsClient.sendProgress(pid, getUserId(), progress, status, detailedProgress);
}

export async function sendComplete(pid, result = null) {
  if (!pid) return;

  logger.info(`Sending complete - PID: ${pid}`);
  wsClient.sendComplete(pid, getUserId(), result);
}

export async function sendError(pid, error) {
  if (!pid) return;

  logger.error(`Sending error - PID: ${pid}`, error.message);
  wsClient.sendError(pid, getUserId(), error);
}

let currentUserId = null;

export function setUserId(userId) {
  currentUserId = userId;
}

export function getUserId() {
  return currentUserId;
}

export function getProcessId(req) {
  const userId = req.headers["x-user-id"];
  if (userId) {
    setUserId(userId);
  }

  return req.headers["x-process-id"] || null;
}
