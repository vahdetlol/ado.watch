import { Route } from 'owebjs';
import Tag from '../../models/tag.js';
import { authenticate, authorize } from '../../middleware/auth.js';

// PUT /api/tags/:id - Tag güncelle (Admin veya Moderator)
export default class extends Route {
  middleware = [authenticate, authorize('admin', 'moderator')];

  async handle(req, res) {
  try {
    const { name, slug } = req.body;
    const tag = await Tag.findByIdAndUpdate(
      req.params.id,
      { name, slug },
      { new: true }
    );

    if (!tag) {
      return res.status(404).send({ 
        success: false,
        message: 'Tag not found' 
      });
    }
    res.send({
      success: true,
      message: 'Tag updated successfully',
      data: tag
    });
    } catch (error) {
      res.status(500).send({ 
        success: false,
        message: 'Can\'t update tag', 
        error: error.message 
      });
    }
  }
}
