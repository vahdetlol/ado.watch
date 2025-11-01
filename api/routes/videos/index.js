import { Route } from 'owebjs';
import Video from '../../models/Video.js';

// GET /api/videos - List all videos (pagination + filtering)
export default class extends Route {
  async handle(req, res) {
    try {
      const { page = 1, limit = 10, category, tag, search } = req.query;
      const query = {};

      if (category) query.categories = category;
      if (tag) query.tags = tag;
      if (search) query.title = { $regex: search, $options: 'i' };

      const videos = await Video.find(query)
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .select('_id title description mimeType size1 thumbnail duration categories tags views createdAt updatedAt');

      const count = await Video.countDocuments(query);

      res.send({
        videos,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        total: count
      });
    } catch (error) {
      res.status(500).send({ message: 'Can\'t retrieve videos', error: error.message });
    }
  }
}
