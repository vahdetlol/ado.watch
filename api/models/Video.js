import mongoose from 'mongoose';
import { generateId } from '../utils/snowflake.js';
import { getNow } from '../utils/timezone.js';

const videoSchema = new mongoose.Schema(
  {
    _id: { type: String, default: generateId },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    url1: { type: String, required: true }, // Physical file path
    url2: { type: String, default: null }, // 720p version file path
    mimeType: { type: String, default: "video/mp4" },
    size1: { type: Number, required: true }, // In bytes
    size2: { type: Number, default: null }, // 720p version size in bytes
    thumbnail: { type: String }, // Thumbnail URL
    duration: { type: Number, default: 0 }, // In seconds
    views: { type: Number, default: 0 }, // View count
    categories: [{ type: String }], // Category names (string array)
    tags: [{ type: String }], // Tag names (string array)
  },
  { 
    timestamps: {
      currentTime: () => getNow()
    }
  }
);

export default mongoose.model("Video", videoSchema);
