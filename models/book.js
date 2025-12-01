const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    author: { type: String, required: true },
    description: { type: String },
    file_url: { type: String, required: true },
    cover_url: { type: String },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    views: { type: Number, default: 0 },
    // has_chapters: { type: Boolean, default: false },
    is_active: { type: Boolean, default: true },
    // Encryption metadata for AES-256-GCM encrypted ebook files
    encryption_iv: { type: String }, // Base64 encoded IV (Initialization Vector)
    encryption_authTag: { type: String }, // Base64 encoded authentication tag
    // In production, also store: encrypted_key (book-specific key encrypted with master key)
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

module.exports = mongoose.model("Book", bookSchema);
