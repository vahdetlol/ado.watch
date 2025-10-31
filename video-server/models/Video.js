import mongoose from "mongoose";
import { generateId } from "../utils/snowflake.js";
import { getNow } from "../utils/timezone.js";

const VideoSchema = new mongoose.Schema(
  {
    _id: { type: String, default: generateId },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    url1: { type: String, required: true },
    url2: { type: String, default: null },
    mimeType: { type: String, default: "video/mp4" },
    size1: { type: Number, required: true },
    size2: { type: Number, default: null },
    thumbnail: { type: String, default: null },
    duration: { type: Number, default: 0 },
    categories: [{ type: String, ref: "Category" }],
    tags: [{ type: String, ref: "Tag" }],
    uploader: [{ type: String, ref: "User", required: true },
    ],
    views: { type: Number, default: 0 },
    createdAt: { type: Date, default: getNow },
  },
  { timestamps: { currentTime: () => getNow() } }
);

export default mongoose.model("Video", VideoSchema);
