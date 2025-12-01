// routes/book.test.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const Book = require("../models/book");
const AppError = require("../utils/error");
const { decryptFileToBuffer, decodeEncryptionMetadata } = require("../utils/encryption");

const router = express.Router();

/**
 * GET /books/:id/test-pdf
 * Trả về file PDF đã giải mã
 */
router.get("/:id/test-pdf", async (req, res, next) => {
  try {
    const bookId = req.params.id;

    // 1. Lấy thông tin sách từ DB
    const book = await Book.findById(bookId);
    if (!book || !book.is_active) {
      throw new AppError(404, "Không tìm thấy sách hoặc sách không khả dụng");
    }

    if (!book.file_url || !book.encryption_iv || !book.encryption_authTag) {
      throw new AppError(500, "Sách chưa được mã hóa đúng cách");
    }

    // 2. Lấy file path từ URL
    const filenameMatch = book.file_url.match(/\/uploads\/books\/(.+)$/);
    if (!filenameMatch) throw new AppError(500, "File URL không hợp lệ");
    const encryptedFilename = filenameMatch[1];
    const encryptedFilePath = path.join(__dirname, "..", "uploads", "books", encryptedFilename);

    if (!fs.existsSync(encryptedFilePath)) {
      throw new AppError(404, "File ebook đã mã hóa không tồn tại trên server");
    }

    // 3. Giải mã metadata
    const { iv, authTag } = decodeEncryptionMetadata(book.encryption_iv, book.encryption_authTag);

    // 4. Giải mã file ra Buffer
    const decryptedBuffer = await decryptFileToBuffer(encryptedFilePath, iv, authTag);

    // 5. Trả về file PDF cho client
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${book.title}.pdf"`);
    res.send(decryptedBuffer);

  } catch (err) {
    next(err);
  }
});

module.exports = router;
