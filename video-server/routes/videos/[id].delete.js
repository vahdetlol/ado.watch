import { Route } from 'owebjs';
import Video from '../../models/Video.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DELETE /api/videos/:id - Delete video (Admin or Moderator)
export default class extends Route {
  async handle(req, reply) {
    // Manual middleware execution
    await authenticate(req, reply);
    if (reply.sent) return;
    
    await authorize('admin', 'moderator')(req, reply);
    if (reply.sent) return;
    
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return reply.status(404).send({ 
        success: false,
        message: 'Video not found' 
      });
    }

  // Delete physical files
    if (fs.existsSync(video.filename)) {
      fs.unlinkSync(video.filename);
    }
    if (video.thumbnail) {
  // Uploads folder in the main project directory
      const thumbPath = path.join(__dirname, '..', '..', '..', video.thumbnail);
      if (fs.existsSync(thumbPath)) {
        fs.unlinkSync(thumbPath);
      }
    }

    await Video.findByIdAndDelete(req.params.id);
    return reply.send({ 
      success: true,
      message: 'Video deleted successfully' 
    });
    } catch (error) {
      return reply.status(500).send({ 
        success: false,
        message: 'Can\'t delete video', 
        error: error.message 
      });
    }
  }
}
