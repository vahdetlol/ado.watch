import { Route } from 'owebjs';
import Tag from '../../models/tag.js';
import { authenticate, authorize } from '../../middleware/auth.js';

// DELETE /api/tags/:id - Delete tag (Admin only)
export default class extends Route {
  middleware = [authenticate, authorize('admin')];

  async handle(req, res) {
  try {
    const tag = await Tag.findByIdAndDelete(req.params.id);
    if (!tag) {
      return res.status(404).send({ 
        success: false,
        message: 'Tag not found' 
      });
    }
    res.send({ 
      success: true,
      message: 'Tag deleted successfully' 
    });
    } catch (error) {
      res.status(500).send({ 
        success: false,
        message: 'Can\'t delete tag', 
        error: error.message 
      });
    }
  }
}
