import { Route } from 'owebjs';
import Video from '../../models/Video.js';
import { authenticate, authorize } from '../../middleware/auth.js';

// PUT /api/videos/:id - Update video (Admin or Moderator)
export default class extends Route {
  async handle(req, reply) {
    // Manual middleware execution
    await authenticate(req, reply);
    if (reply.sent) return; // If auth failed, response already sent
    
    await authorize('admin', 'moderator')(req, reply);
    if (reply.sent) return; // If authz failed, response already sent
    
  try {
    const { title, description, categories, tags } = req.body;
    const updated = await Video.findByIdAndUpdate(
      req.params.id,
      { title, description, categories, tags },
      { new: true }
    );

    if (!updated) {
      return reply.status(404).send({ 
        success: false,
        message: 'Video not found' 
      });
    }
    console.log(`Video ${req.params.id} updated by user ${req.user.username}`);

    return reply.send({
      success: true,
      message: 'Video updated successfully',
      data: updated
    });
    } catch (error) {
      return reply.status(500).send({ 
        success: false,
        message: 'Can\'t update video', 
        error: error.message 
      });
    }
  }
}
