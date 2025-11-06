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
    categories: [{ type: String, ref: "Category" }],
    tags: [{ type: String, ref: "Tag" }],
    uploader: [{ type: String, ref: "User", required: true }],
    views: { type: Number, default: 0 },
    createdAt: { type: Date, default: getNow },
  },
    {
      timestamps: {
        currentTime: () => getNow(),
      },
    }
);

export default mongoose.model("Video", VideoSchema);
