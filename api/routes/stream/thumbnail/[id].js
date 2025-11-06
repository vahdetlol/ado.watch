import { Route } from 'owebjs';
import https from 'https';
import Video from '../../../models/Video.js';

export default class extends Route {
  async handle(req, reply) {
    try {
      const id = req.params.id;
      
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
      reply.header('Access-Control-Expose-Headers', 'Content-Type, Content-Length, Cache-Control');
      
      const video = await Video.findById(id);
      
      if (!video) {
        return reply.status(404).send({ error: "Video not found" });
      }

      if (!video.thumbnail) {
        return reply.status(404).send({ error: "Thumbnail not found for this video" });
      }

      console.log(`Streaming thumbnail from B2: ${video.title}`);

      return new Promise((resolve, reject) => {
        const proxyRequest = https.get(video.thumbnail, (b2Response) => {
          reply.code(b2Response.statusCode);
          
          if (b2Response.headers['content-type']) {
            reply.header('Content-Type', b2Response.headers['content-type']);
          }
          if (b2Response.headers['content-length']) {
            reply.header('Content-Length', b2Response.headers['content-length']);
          }
          if (b2Response.headers['last-modified']) {
            reply.header('Last-Modified', b2Response.headers['last-modified']);
          }
          if (b2Response.headers['etag']) {
            reply.header('ETag', b2Response.headers['etag']);
          }
          
          reply.header('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours

          b2Response.on('error', (error) => {
            console.error('B2 thumbnail stream error:', error);
            reject(error);
          });

          b2Response.on('end', () => {
            resolve();
          });

          reply.send(b2Response);
        });

        proxyRequest.on('error', (error) => {
          console.error('B2 thumbnail request error:', error);
          if (!reply.sent) {
            reply.code(500).send({ error: "Thumbnail stream error from B2" });
          }
          reject(error);
        });

        proxyRequest.setTimeout(15000, () => {
          proxyRequest.destroy();
          console.error('B2 thumbnail request timeout');
          if (!reply.sent) {
            reply.code(504).send({ error: "Thumbnail stream timeout" });
          }
          reject(new Error('Request timeout'));
        });
      });

    } catch (error) {
      console.error('Thumbnail stream error:', error);
      return reply.status(500).send({ error: "Thumbnail stream error", message: error.message });
    }
  }
}
