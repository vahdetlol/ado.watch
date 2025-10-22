import mongoose from "mongoose";
import { generateId } from '../utils/snowflake.js';

const VideoSchema = new mongoose.Schema({
  _id: { type: String, default: generateId },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: "",
  },
  filename: {
    type: String,
    required: true,
  },
  mimeType: {
    type: String,
    default: "video/mp4",
  },
  size: {
    type: Number,
    required: true,
  },
  thumbnail: {
    type: String,
    default: null,
  },
  duration: {
    type: Number,
    default: 0,
  },
  categories: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
  ],
  tags: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tag",
    },
  ],
  views: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("Video", VideoSchema);
