import { Route } from "owebjs";
import Video from "../../models/Video.js";

const defaultpage = 1;
const defaultlimit = 10;
const maxlimit = 100;
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// GET /api/videos - List all videos (pagination + filtering)
export default class extends Route {
  async handle(req, reply) {
    try {
      const page = Math.max(1, parseInt(req.query.page) || defaultpage);
      const limit = Math.min(
        maxlimit,
        Math.max(1, parseInt(req.query.limit) || defaultlimit)
      );
      const { category, tag, search } = req.query;

      const query = {};

      if (category) {
        query.categories = category;
      }

      if (tag) {
        query.tags = tag;
      }

      if (search && typeof search === "string" && search.trim()) {
        const sanitizedSearch = escapeRegex(search.trim());
        query.title = { $regex: sanitizedSearch, $options: "i" };
      }

      const skip = (page - 1) * limit;
      const [videos, count] = await Promise.all([
        Video.find(query)
          .select(
            "_id title description thumbnail duration categories tags views createdAt"
          )
          .sort({ createdAt: -1 })
          .limit(limit)
          .skip(skip)
          .lean(),
        Video.countDocuments(query),
      ]);

      return reply.send({
        videos,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        total: count,
      });
    } catch (error) {
      console.error("Error retrieving videos:", error);
      return reply.status(500).send({
        message: "Unable to retrieve videos. Please try again later.",
      });
    }
  }
}
