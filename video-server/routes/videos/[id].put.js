import { Route } from 'owebjs';
import Video from '../../models/Video.js';

// PUT /videos/:id - Update video
export default class extends Route {
  async handle(req, reply) {
  try {
    const { title, description, categories, tags, _user } = req.body;
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
    console.log(`Video ${req.params.id} updated by user ${_user?.username || 'unknown'}`);

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
