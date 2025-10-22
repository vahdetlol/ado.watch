import mongoose from "mongoose";
import { generateId } from '../utils/snowflake.js';

const categorySchema = new mongoose.Schema({
  _id: { type: String, default: generateId },
  name: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true },
});

export default mongoose.model("Category", categorySchema);
