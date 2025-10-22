import { Route } from 'owebjs';
import Tag from '../../models/tag.js';
import { authenticate, authorize } from '../../middleware/auth.js';

// POST /api/tags - Yeni tag oluştur (Admin veya Moderator)
export default class extends Route {
  middleware = [authenticate, authorize('admin', 'moderator')];

  async handle(req, res) {
  try {
    const { name, slug } = req.body;
    
    if (!name || !slug) {
      return res.status(400).send({ 
        success: false,
        message: 'Name and slug are required' 
      });
    }

    const tag = new Tag({ name, slug });
    await tag.save();
    
    res.status(201).send({
      success: true,
      message: 'Tag created successfully',
      data: tag
    });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).send({ 
          success: false,
          message: 'This tag already exists' 
        });
      }
      res.status(500).send({ 
        success: false,
        message: 'Can\'t create tag', 
        error: error.message 
      });
    }
  }
}
