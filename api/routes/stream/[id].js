import { Route } from 'owebjs';
import https from 'https';
import Video from '../../models/Video.js';

export default class extends Route {
  async handle(req, reply) {
    try {
      const id = req.params.id;
      const quality = req.query.quality; 

      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
      reply.header('Access-Control-Allow-Headers', 'Range, Content-Type');
      reply.header('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
      
      const video = await Video.findById(id);
      
      if (!video) {
        return reply.status(404).send({ error: "Video not found" });
      }

      let streamUrl = null;
      let selectedResolution = null;

      if (!video.resolutions || video.resolutions.length === 0) {
        return reply.status(404).send({ 
          error: "No video resolutions available",
          message: "This video does not have any playable resolutions"
        });
      }

      if (quality) {
        selectedResolution = video.resolutions.find(r => r.resolution === quality);
        
        if (!selectedResolution) {
          const availableQualities = video.resolutions.map(r => r.resolution);
          return reply.status(400).send({ 
            error: "Requested quality not available",
            available: availableQualities,
            requested: quality
          });
        }
      } else {
        selectedResolution = video.resolutions.sort((a, b) => {
          const aValue = parseInt((a.resolution.match(/\d+/) || [0])[0], 10);
          const bValue = parseInt((b.resolution.match(/\d+/) || [0])[0], 10);
          return bValue - aValue;
        })[0];
      }
      
      streamUrl = selectedResolution.url;
      console.log(` Streaming ${video.title} ${selectedResolution.resolution}`);
      
      if (!streamUrl) {
        return reply.status(404).send({ error: "Video URL not found" });
      }

      return new Promise((resolve, reject) => {
        const range = req.headers.range;
        const requestOptions = {
          headers: {}
        };

        if (range) {
          requestOptions.headers['Range'] = range;
        }

        const proxyRequest = https.get(streamUrl, requestOptions, (b2Response) => {
          reply.code(b2Response.statusCode);
          
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
          if (b2Response.headers['last-modified']) {
            reply.header('Last-Modified', b2Response.headers['last-modified']);
          }
          if (b2Response.headers['etag']) {
            reply.header('ETag', b2Response.headers['etag']);
          }

          b2Response.on('error', (error) => {
            console.error('B2 response stream error:', error);
            reject(error);
          });

          b2Response.on('end', () => {
            resolve();
          });

          reply.send(b2Response);
        });

        proxyRequest.on('error', (error) => {
          console.error('B2 request error:', error);
          if (!reply.sent) {
            reply.code(500).send({ error: "Video stream error from B2" });
          }
          reject(error);
        });

        proxyRequest.setTimeout(30000, () => {
          proxyRequest.destroy();
          console.error('B2 request timeout');
          if (!reply.sent) {
            reply.code(504).send({ error: "Video stream timeout" });
          }
          reject(new Error('Request timeout'));
        });
      });

    } catch (error) {
      console.error('Stream error:', error);
      return reply.status(500).send({ error: "Video stream error", message: error.message });
    }
  }
}
