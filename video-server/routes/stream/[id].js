import { Route } from 'owebjs';
import fs from 'fs';
import Video from '../../models/Video.js';

// GET /api/stream/:id - Video stream
export default class extends Route {
  async handle(req, reply) {
    try {
      const id = req.params.id;
      
      // CORS headers for video streaming
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
      reply.header('Access-Control-Allow-Headers', 'Range');
      
      const video = await Video.findById(id);
      
      if (!video) return reply.status(404).send("video not found");

      const filePath = video.filename;
      
      console.log(`📺 Wanted a video stream: ${video.title} (${filePath})`);
      
      if (!fs.existsSync(filePath)) {
        return reply.status(404).send("video file not found");
      }

      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (!range) {
        reply.type(video.mimeType || "video/mp4");
        reply.header("Content-Length", fileSize);
        return reply.send(fs.createReadStream(filePath));
      }

      // Range: "bytes=start-end"
      const parts = range.replace(/bytes=/, '').split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        return reply.status(416).header("Content-Range", `bytes */${fileSize}`).send();
      }

      const chunkSize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });

      reply.status(206);
      reply.header("Content-Range", `bytes ${start}-${end}/${fileSize}`);
      reply.header("Accept-Ranges", "bytes");
      reply.header("Content-Length", chunkSize);
      reply.type(video.mimeType || "video/mp4");

      return reply.send(file);
    } catch (error) {
      console.error('Stream error:', error);
      return reply.status(500).send("Video stream error");
    }
  }
}
