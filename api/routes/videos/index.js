import { Route } from "owebjs";
import Video from "../../models/Video.js";
import { createLogger } from "../../utils/logger.js";

const logger = createLogger("VIDEOS");

const escapeRegex = (str) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

export default class extends Route {
  async handle(req, res) {
    try {
      // Safe pagination with limits
      const page = Math.max(1, Math.min(10000, parseInt(req.query.page) || 1));
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
      const query = {};
      const { category, tag, search } = req.query;

      // Input validation and sanitization
      if (category && typeof category === "string") {
        const sanitizedCategory = category.substring(0, 100).trim();
        if (sanitizedCategory) {
          query.categories = sanitizedCategory;
        }
      }

      if (tag && typeof tag === "string") {
        const sanitizedTag = tag.substring(0, 100).trim();
        if (sanitizedTag) {
          query.tags = sanitizedTag;
        }
      }

      if (search && typeof search === "string") {
        const sanitizedSearch = search.substring(0, 100).trim();
        if (sanitizedSearch) {
          // Escape regex special characters
          query.title = { $regex: escapeRegex(sanitizedSearch), $options: "i" };
        }
      }

      const videos = await Video.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit)
        .select(
          "_id title description mimeType resolutions.resolution resolutions.size duration categories tags views createdAt updatedAt"
        )
        .lean(); // Performance improvement - returns plain objects

      const count = await Video.countDocuments(query);

      res.send({
        success: true,
        videos,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        total: count,
      });
    } catch (error) {
      logger.error("Error retrieving videos", error);
      res.status(500).send({
        success: false,
        message: "Can't retrieve videos",
      });
    }
  }
}
