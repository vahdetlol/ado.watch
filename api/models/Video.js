import mongoose from 'mongoose';
import { generateId } from '../utils/snowflake.js';

const videoSchema = new mongoose.Schema(
  {
    _id: { type: String, default: generateId },
    title: { type: String, required: true },
    description: { type: String, default: "" },
  filename: { type: String, required: true }, // Physical file path
    mimeType: { type: String, default: "video/mp4" },
  size: { type: Number, required: true }, // In bytes
  thumbnail: { type: String }, // Thumbnail URL
  duration: { type: Number, default: 0 }, // In seconds
  views: { type: Number, default: 0 }, // View count
  categories: [{ type: String }], // Category names (string array)
  tags: [{ type: String }], // Tag names (string array)
  },
  { timestamps: true }
);

export default mongoose.model("Video", videoSchema);
