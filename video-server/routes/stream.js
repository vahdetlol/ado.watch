import express from 'express';
import fs from 'fs';
import Video from '../models/Video.js';

const router = express.Router();

router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    
    // CORS headers for video streaming
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    
    const video = await Video.findById(id);
    
    if (!video) return res.status(404).send("video not found");

    const filePath = video.filename;
    
    console.log(`📺 Wanted a video stream: ${video.title} (${filePath})`); // Debug log
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).send("video file not found");
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (!range) {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": video.mimeType || "video/mp4"
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // Range: "bytes=start-end"
    const parts = range.replace(/bytes=/, '').split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize) {
      res.writeHead(416, {
        "Content-Range": `bytes */${fileSize}`
      });
      return res.end();
    }

    const chunkSize = (end - start) + 1;
    const file = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": video.mimeType || "video/mp4"
    });

    file.pipe(res);
  } catch (error) {
    console.error('Stream error:', error);
    res.status(500).send("Video stream error");
  }
});

export default router;
