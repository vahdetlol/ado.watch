const mongoose = require("mongoose");

const videoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    filename: { type: String, required: true }, // Fiziksel dosya yolu
    mimeType: { type: String, default: "video/mp4" },
    size: { type: Number, required: true }, // Byte cinsinden
    thumbnail: { type: String }, // Thumbnail URL'i
    duration: { type: Number, default: 0 }, // Saniye cinsinden
    views: { type: Number, default: 0 }, // İzlenme sayısı
    categories: [{ type: String }], // Kategori isimleri (string array)
    tags: [{ type: String }], // Tag isimleri (string array)
  },
  { timestamps: true }
);

module.exports = mongoose.model("Video", videoSchema);
