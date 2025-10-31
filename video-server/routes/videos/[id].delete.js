import { Route } from 'owebjs';
import Video from '../../models/Video.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { deleteFromB2 } from '../../utils/backblaze.js';

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

    // Delete files from Backblaze B2
    try {
      if (video.b2FileId && video.url1) {
        const fileName = video.url1.split('/').pop();
        await deleteFromB2(video.b2FileId, `videos/${fileName}`);
        console.log(`Deleted main video from B2: ${fileName}`);
      }
      
      if (video.b2FileId720p && video.url2) {
        const fileName720p = video.url2.split('/').pop();
        await deleteFromB2(video.b2FileId720p, `videos/${fileName720p}`);
        console.log(`Deleted 720p video from B2: ${fileName720p}`);
      }
      
      if (video.b2ThumbnailId && video.thumbnail) {
        const thumbFileName = video.thumbnail.split('/').pop();
        await deleteFromB2(video.b2ThumbnailId, `thumbnails/${thumbFileName}`);
        console.log(`Deleted thumbnail from B2: ${thumbFileName}`);
      }
    } catch (b2Error) {
      console.warn('B2 deletion error (continuing with DB deletion):', b2Error.message);
    }

    // Delete from database
    await Video.findByIdAndDelete(req.params.id);
    console.log(`Video ${req.params.id} deleted by user ${req.user.username}`);
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
