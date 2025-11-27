import mongoose from "mongoose";
import { generateId } from "../utils/snowflake.js";
import { getNow } from "../utils/timezone.js";

const videoSchema = new mongoose.Schema(
  {
    _id: { type: String, default: generateId },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    resolutions: [
      {
        resolution: { type: String, required: true },
        url: { type: String, required: true },
        size: { type: Number, required: true },
        width: { type: Number, required: true },
        height: { type: Number, required: true },
        isVertical: { type: Boolean, default: false },
      },
    ],
    mimeType: { type: String, default: "video/mp4" },
    thumbnail: { type: String },
    duration: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    uploader: { type: String, ref: "User" },
    categories: [{ type: String }],
    tags: [{ type: String }],
  },
  {
    timestamps: {
      currentTime: () => getNow(),
    },
  }
);

videoSchema.index({ createdAt: -1 });
videoSchema.index({ views: -1 });
videoSchema.index({ uploader: 1 });
videoSchema.index({ categories: 1 });
videoSchema.index({ tags: 1 });
videoSchema.index({ title: "text", description: "text" });

export default mongoose.model("Video", videoSchema);
