import { Route } from 'owebjs';
import fs from 'fs';
import https from 'https';
import Video from '../../models/Video.js';

// GET /api/stream/:id - Video stream from Backblaze B2 (supports ?quality=720p parameter)
export default class extends Route {
  async handle(req, reply) {
    try {
      const id = req.params.id;
      const quality = req.query.quality; // 'original' or '720p'
      
      // CORS headers for video streaming
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
      reply.header('Access-Control-Allow-Headers', 'Range');
      
      const video = await Video.findById(id);
      
      if (!video) return reply.status(404).send("video not found");

      // Determine which URL to stream based on quality parameter
      let streamUrl = video.url1; // default to original/main version
      
      if (quality === '720p' && video.url2) {
        streamUrl = video.url2;
        console.log(`📺 Streaming 720p from B2: ${video.title}`);
      } else {
        console.log(`📺 Streaming original from B2: ${video.title}`);
      }
      
      if (!streamUrl) {
        return reply.status(404).send("video url not found");
      }

      // Proxy request to Backblaze B2
      const range = req.headers.range;
      const requestOptions = {
        headers: {}
      };

      if (range) {
        requestOptions.headers['Range'] = range;
      }

      https.get(streamUrl, requestOptions, (b2Response) => {
        // Forward status code
        reply.code(b2Response.statusCode);
        
        // Forward relevant headers
        if (b2Response.headers['content-type']) {
          reply.header('Content-Type', b2Response.headers['content-type']);
        }
        if (b2Response.headers['content-length']) {
          reply.header('Content-Length', b2Response.headers['content-length']);
        }
        if (b2Response.headers['content-range']) {
          reply.header('Content-Range', b2Response.headers['content-range']);
        }
        if (b2Response.headers['accept-ranges']) {
          reply.header('Accept-Ranges', b2Response.headers['accept-ranges']);
        }

        // Send the response and pipe the B2 stream
        reply.send(b2Response);
      }).on('error', (error) => {
        console.error('B2 stream error:', error);
        if (!reply.sent) {
          reply.code(500).send("Video stream error from B2");
        }
      });

    } catch (error) {
      console.error('Stream error:', error);
      return reply.status(500).send("Video stream error");
    }
  }
}
