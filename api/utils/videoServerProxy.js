import { wsManager } from "./websocketManager.js";

const VIDEO_SERVER_URL =
  process.env.VIDEO_SERVER_URL || "http://127.0.0.1:5001";

export async function proxyToVideoServerWithProgress(
  path,
  options = {},
  userId,
  pid
) {
  const url = `${VIDEO_SERVER_URL}${path}`;

  try {
    wsManager.createProgressSession(userId, pid);

    // Timeout controller - 30 dakika
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30 * 60 * 1000);

    fetch(url, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Process-Id": pid,
        "X-User-Id": userId,
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    })
      .then(() => {
        clearTimeout(timeoutId);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        if (error.name === "AbortError") {
          console.error("[Proxy] Video server request timeout");
          wsManager.failProgress(pid, new Error("Request timeout"));
        } else {
          console.error("[Proxy] Video server request failed:", error.message);
          wsManager.failProgress(pid, error);
        }
      });

    return { ok: true };
  } catch (error) {
    console.error("Video server proxy error:", error);
    wsManager.failProgress(pid, error);
    throw new Error(`Failed to connect to video server: ${error.message}`);
  }
}
export async function proxyToVideoServer(path, options = {}) {
  const url = `${VIDEO_SERVER_URL}${path}`;

  try {
    const response = await fetch(url, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    return response;
  } catch (error) {
    console.error("Video server proxy error:", error);
    throw new Error(`Failed to connect to video server: ${error.message}`);
  }
}

export async function proxyMultipartToVideoServerWithProgress(
  path,
  req,
  userId,
  pid
) {
  const url = `${VIDEO_SERVER_URL}${path}`;

  try {
    wsManager.createProgressSession(userId, pid);

    fetch(url, {
      method: req.method,
      headers: {
        ...req.headers,
        "X-Process-Id": pid,
        "X-User-Id": userId,
      },
      body: req.raw,
      duplex: "half",
    }).catch((error) => {
      console.error(
        "[Proxy] Video server multipart request failed:",
        error.message
      );
      wsManager.failProgress(pid, error);
    });

    return { ok: true };
  } catch (error) {
    console.error("Video server multipart proxy error:", error);
    wsManager.failProgress(pid, error);
    throw new Error(`Failed to connect to video server: ${error.message}`);
  }
}

/**
 * Forward a multipart/form-data request to video-server
 * @param {string} path - The path to forward to
 * @param {object} req - Fastify request object
 * @returns {Promise<Response>}
 */
export async function proxyMultipartToVideoServer(path, req) {
  const url = `${VIDEO_SERVER_URL}${path}`;

  try {
    const response = await fetch(url, {
      method: req.method,
      headers: {
        ...req.headers,
      },
      body: req.raw,
      duplex: "half",
    });

    return response;
  } catch (error) {
    console.error("Video server multipart proxy error:", error);
    throw new Error(`Failed to connect to video server: ${error.message}`);
  }
}

/**
 * Send proxied response back to client
 * @param {object} reply - Fastify reply object
 * @param {Response} response - Fetch response from video-server
 */
export async function sendProxiedResponse(reply, response) {
  reply.status(response.status);

  response.headers.forEach((value, key) => {
    reply.header(key, value);
  });

  const contentType = response.headers.get("content-type");

  if (contentType && contentType.includes("application/json")) {
    const data = await response.json();
    return reply.send(data);
  } else {
    const data = await response.text();
    return reply.send(data);
  }
}
