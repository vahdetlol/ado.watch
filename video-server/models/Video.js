import mongoose from "mongoose";
import { generateId } from "../utils/snowflake.js";
import { getNow } from "../utils/timezone.js";

const VideoSchema = new mongoose.Schema(
  {
    _id: { type: String, default: generateId },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    resolutions: [
      {
        resolution: { type: String },
        url: { type: String, required: true },
        size: { type: Number, required: true },
        width: { type: Number },
        height: { type: Number },
        isVertical: { type: Boolean, default: false },
        b2FileId: { type: String },
      },
    ],
    mimeType: { type: String, default: "video/mp4" },
    thumbnail: { type: String, default: null },
    duration: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    uploader: { type: String, ref: "User", required: true },
    categories: [{ type: String, ref: "Category" }],
    tags: [{ type: String, ref: "Tag" }],
    createdAt: { type: Date, default: getNow },
  },
  {
    timestamps: {
      currentTime: () => getNow(),
    },
  }
);

// Indexes for better query performance
VideoSchema.index({ createdAt: -1 });
VideoSchema.index({ views: -1 });
VideoSchema.index({ uploader: 1 });
VideoSchema.index({ categories: 1 });
VideoSchema.index({ tags: 1 });
VideoSchema.index({ title: "text", description: "text" });

export default mongoose.model("Video", VideoSchema);
