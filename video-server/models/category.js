import mongoose from "mongoose";
import { generateId } from '../utils/snowflake.js';
import { getNow } from '../utils/timezone.js';

const categorySchema = new mongoose.Schema({
  _id: { type: String, default: generateId },
  name: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true },
}, {
  timestamps: {
    currentTime: () => getNow()
  }
});

export default mongoose.model("Category", categorySchema);
