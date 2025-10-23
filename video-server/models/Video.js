import mongoose from "mongoose";
import { generateId } from '../utils/snowflake.js';
import { getNow } from '../utils/timezone.js';

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
    default: getNow,
  },
}, {
  timestamps: {
    currentTime: () => getNow()
  }
});

export default mongoose.model("Video", VideoSchema);
