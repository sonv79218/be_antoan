const Book = require("../models/book");
const BookChapter = require("../models/bookChapter");
const AppError = require("../utils/error");
const { deleteFileIfExists } = require("../utils/file");
const {
  encryptFile,
  encodeEncryptionMetadata,
  decodeEncryptionMetadata,
  decryptFileToBuffer,
} = require("../utils/encryption");
const fs = require("fs");
const path = require("path");

const buildPublicUrl = (folder, filename) =>
  `http://localhost:5000/uploads/${folder}/${filename}`;

/**
 * Helper function to decrypt ebook file and return as base64 string
 * 
 * @param {Object} book - Book document from MongoDB
 * @returns {Promise<string|null>} - Base64 encoded decrypted content or null if not available
 */
const decryptBookContent = async (book) => {
  // Check if book has encryption metadata
  if (!book.encryption_iv || !book.encryption_authTag || !book.file_url) {
    console.warn("⚠️  Book missing encryption metadata or file URL", {
      bookId: book._id,
      hasIV: !!book.encryption_iv,
      hasAuthTag: !!book.encryption_authTag,
      hasFileUrl: !!book.file_url,
    });
    return null;
  }

  try {
    // Extract encrypted file path from URL
    const fileUrl = book.file_url;
    const filenameMatch = fileUrl.match(/\/uploads\/books\/(.+)$/);

    if (!filenameMatch) {
      console.error("❌ Invalid file URL format", { fileUrl });
      return null;
    }

    const encryptedFilename = filenameMatch[1];
    const encryptedFilePath = path.join(
      __dirname,
      "..",
      "uploads",
      "books",
      encryptedFilename
    );

    // Validate encrypted file exists
    if (!fs.existsSync(encryptedFilePath)) {
      console.error("❌ Encrypted file not found", { encryptedFilePath });
      return null;
    }

    // Decode encryption metadata
    const { iv, authTag } = decodeEncryptionMetadata(
      book.encryption_iv,
      book.encryption_authTag
    );

    // Decrypt file to buffer
    const decryptedBuffer = await decryptFileToBuffer(
      encryptedFilePath,
      iv,
      authTag
    );

    // Convert to base64 string for JSON response
    const base64Content = decryptedBuffer.toString("base64");

    console.log("✅ Book content decrypted", {
      bookId: book._id,
      contentSize: decryptedBuffer.length,
      base64Length: base64Content.length,
    });

    return base64Content;
  } catch (error) {
    console.error("❌ Failed to decrypt book content", {
      bookId: book._id,
      error: error.message,
    });
    // Return null instead of throwing to allow metadata to still be returned
    return null;
  }
};

/**
 * Create a new book with encrypted ebook file
 * 
 * @param {Object} payload - Book metadata (title, author, description, category)
 * @param {Object} files - Uploaded files (cover_url, file_url)
 * @param {Array} chapters - Optional chapters array
 * @returns {Promise<Object>} - Created book with metadata
 * 
 * Security:
 * - Ebook file is encrypted with AES-256-GCM before saving
 * - Cover image is saved as plaintext
 * - Encryption metadata (IV, authTag) is stored in MongoDB
 */
const createBook = async (payload, files) => {
  const { title, author, description, category } = payload;

  // Validate required fields
  if (!title || !author || !category) {
    throw new AppError(400, "Thiếu thông tin bắt buộc của sách.");
  }

  const cover = files?.cover_url?.[0];
  const ebookFile = files?.file_url?.[0];

  // Validate ebook file exists
  if (!ebookFile) {
    throw new AppError(400, "Ebook file is required.");
  }

  // Validate uploaded files exist on disk
  const uploadsDir = path.join(__dirname, "..", "uploads", "books");
  //Định vị file PDF upload tạm
  const originalEbookPath = path.join(uploadsDir, ebookFile.filename);

  if (!fs.existsSync(originalEbookPath)) {
    throw new AppError(400, "Uploaded ebook file not found on server.");
  }

  // Encrypt the ebook file
  // Create encrypted file path (append .encrypted extension)
  const encryptedEbookPath = `${originalEbookPath}.encrypted`;
  let encryptionMetadata;

  try {
    console.log("🔐 Encrypting ebook file...", { filename: ebookFile.filename });

    // Encrypt the file and get IV and authTag
    const { iv, authTag } = await encryptFile(
      originalEbookPath,
      encryptedEbookPath
    );

    // Encode metadata for MongoDB storage
    encryptionMetadata = encodeEncryptionMetadata(iv, authTag);

    console.log("✅ Ebook file encrypted successfully");

    // Delete the original plaintext file for security
    fs.unlinkSync(originalEbookPath);
    console.log("🗑️  Original plaintext file deleted");
  } catch (error) {
    // Clean up on encryption failure
    if (fs.existsSync(originalEbookPath)) {
      fs.unlinkSync(originalEbookPath);
    }
    if (fs.existsSync(encryptedEbookPath)) {
      fs.unlinkSync(encryptedEbookPath);
    }
    throw new AppError(
      500,
      `Failed to encrypt ebook file: ${error.message}`
    );
  }

  // Build URLs
  // Cover image: plaintext URL
  const coverUrl = cover
    ? buildPublicUrl("books", cover.filename)
    : "";

  // Ebook: encrypted file URL (with .encrypted extension)
  const encryptedEbookUrl = buildPublicUrl(
    "books",
    `${ebookFile.filename}.encrypted`
  );

  // Create book record in MongoDB with encryption metadata
  const newBook = await Book.create({
    title,
    author,
    description,
    cover_url: coverUrl,
    file_url: encryptedEbookUrl, // Store encrypted file URL
    category,
    // has_chapters: Array.isArray(chapters) && chapters.length > 0,
    encryption_iv: encryptionMetadata.iv,
    encryption_authTag: encryptionMetadata.authTag,
  });

  console.log("✅ Book created in database", { bookId: newBook._id });

  return {
    success: true,
    message: "Tạo sách thành công",
    book: newBook,
  };
};


/**
 * Get all active books
 * - Optionally includes decrypted content for each book
 * - Note: Including content for all books may be memory-intensive
 */
const getAllBooks = async (includeContent = false) => {
  const books = await Book.find({ is_active: true })
    .populate("category", "name")
    .sort({ createdAt: -1 });

  // If content is requested, decrypt for each book
  if (includeContent) {
    const booksWithContent = await Promise.all(
      books.map(async (book) => {
        const bookObject = book.toObject();
        const decryptedContent = await decryptBookContent(book);
        bookObject.content = decryptedContent;
        return bookObject;
      })
    );
    return { success: true, books: booksWithContent };
  }

  return { success: true, books };
};

const getBookLock = async () => {
  const books = await Book.find({ is_active: false })
    .populate("category", "name")
    .sort({ createdAt: -1 });
  return { success: true, books };
};

/**
 * Get book by ID with decrypted content
 * - Increments view count
 * - Decrypts ebook file and includes content in response
 */
const getBookById = async (id) => {
  const book = await Book.findByIdAndUpdate(
    id,
    { $inc: { views: 1 } },
    { new: true }
  ).populate("category", "name");

  if (!book || !book.is_active) {
    throw new AppError(404, "Không tìm thấy sách");
  }

  // Decrypt ebook content
  const decryptedContent = await decryptBookContent(book);

  // Convert book to plain object and add decrypted content
  const bookObject = book.toObject();
  bookObject.content = decryptedContent; // Base64 encoded decrypted content

  return { success: true, book: bookObject };
};

/**
 * Get book by ID without incrementing views
 * - Includes decrypted ebook content
 */
const getBookByIdNoView = async (id) => {
  const book = await Book.findById(id).populate("category", "name");
  if (!book || !book.is_active) {
    throw new AppError(404, "Không tìm thấy sách");
  }

  // Decrypt ebook content
  const decryptedContent = await decryptBookContent(book);

  // Convert book to plain object and add decrypted content
  const bookObject = book.toObject();
  bookObject.content = decryptedContent; // Base64 encoded decrypted content

  return { success: true, book: bookObject };
};

/**
 * Get book by ID (admin only, includes inactive books)
 * - Includes decrypted ebook content
 */
const getAllBookById = async (id) => {
  const book = await Book.findById(id).populate("category", "name");
  if (!book) {
    throw new AppError(404, "Không tìm thấy sách");
  }

  // Decrypt ebook content
  const decryptedContent = await decryptBookContent(book);

  // Convert book to plain object and add decrypted content
  const bookObject = book.toObject();
  bookObject.content = decryptedContent; // Base64 encoded decrypted content

  return { success: true, book: bookObject };
};

const updateCover = async (id, file) => {
  if (!file) {
    throw new AppError(400, "Chưa upload ảnh bìa mới.");
  }

  const updated = await Book.findByIdAndUpdate(
    id,
    { cover_url: `http://localhost:5000/uploads/avatars/${file.filename}` },
    { new: true }
  );

  if (!updated) {
    throw new AppError(404, "Không tìm thấy sách để cập nhật ảnh bìa.");
  }

  return {
    success: true,
    message: "Cập nhật ảnh bìa thành công",
    book: updated,
  };
};

const toggleBookStatus = async (id) => {
  const book = await Book.findById(id);
  if (!book) {
    throw new AppError(400, "Không tìm thấy sách");
  }
  book.is_active = !book.is_active;
  await book.save();

  return {
    message: "Đã cập nhật trạng thái sách",
    is_active: book.is_active,
  };
};

const deleteBook = async (id) => {
  const book = await Book.findById(id);
  if (!book) {
    throw new AppError(404, "Không tìm thấy sách");
  }

  // Delete cover image (plaintext)
  if (book.cover_url) {
    // Extract filename from URL and build local path
    const coverMatch = book.cover_url.match(/\/uploads\/books\/(.+)$/);
    if (coverMatch) {
      const coverPath = path.join(
        __dirname,
        "..",
        "uploads",
        "books",
        coverMatch[1]
      );
      deleteFileIfExists(coverPath);
    }
  }

  // Delete encrypted ebook file
  if (book.file_url) {
    // file_url points to encrypted file (.encrypted extension)
    const fileMatch = book.file_url.match(/\/uploads\/books\/(.+)$/);
    if (fileMatch) {
      const encryptedFilePath = path.join(
        __dirname,
        "..",
        "uploads",
        "books",
        fileMatch[1]
      );
      deleteFileIfExists(encryptedFilePath);
    }
  }

  // Delete chapters
  await BookChapter.deleteMany({ book: book._id });

  // Delete book record
  await Book.findByIdAndDelete(book._id);

  return {
    success: true,
    message: "Đã xóa hoàn toàn sách và các chương",
  };
};

/**
 * Get books by category
 * - Optionally includes decrypted content
 */
const getBooksByCategory = async (categoryId, includeContent = false) => {
  const books = await Book.find({ category: categoryId, is_active: true })
    .populate("category", "name")
    .sort({ created_at: -1 });

  // If content is requested, decrypt for each book
  if (includeContent) {
    const booksWithContent = await Promise.all(
      books.map(async (book) => {
        const bookObject = book.toObject();
        const decryptedContent = await decryptBookContent(book);
        bookObject.content = decryptedContent;
        return bookObject;
      })
    );
    return { success: true, books: booksWithContent };
  }

  return { success: true, books };
};

/**
 * Get top viewed books
 * - Optionally includes decrypted content
 * - By default only returns metadata (title, author, views, cover_url)
 */
const getTopViewedBooks = async (limit = 5, includeContent = false) => {
  // If content is requested, fetch full book documents
  const selectFields = includeContent
    ? undefined // Get all fields
    : "title author views cover_url"; // Get only metadata

  const topBooks = await Book.find()
    .sort({ views: -1 })
    .limit(limit)
    .select(selectFields)
    .populate("category", "name");

  // If content is requested, decrypt for each book
  if (includeContent) {
    const booksWithContent = await Promise.all(
      topBooks.map(async (book) => {
        const bookObject = book.toObject();
        const decryptedContent = await decryptBookContent(book);
        bookObject.content = decryptedContent;
        return bookObject;
      })
    );
    return { success: true, data: booksWithContent };
  }

  return { success: true, data: topBooks };
};

const getPdf = async (bookId) => {
  const book = await Book.findById(bookId);
  if (!book || !book.is_active) {
    throw new AppError(404, "Không tìm thấy sách hoặc sách không khả dụng");
  }

  if (!book.file_url || !book.encryption_iv || !book.encryption_authTag) {
    throw new AppError(500, "Sách chưa được mã hóa đúng cách");
  }

  // Lấy tên file .encrypted từ URL
  const filenameMatch = book.file_url.match(/\/uploads\/books\/(.+)$/);
  if (!filenameMatch) throw new AppError(500, "File URL không hợp lệ");

  const encryptedFilePath = path.join(
    __dirname,
    "..",
    "uploads",
    "books",
    filenameMatch[1]
  );

  if (!fs.existsSync(encryptedFilePath)) {
    throw new AppError(404, "File ebook đã mã hóa không tồn tại trên server");
  }

  // Giải metadata
  const { iv, authTag } = decodeEncryptionMetadata(
    book.encryption_iv,
    book.encryption_authTag
  );

  // Giải mã file ra Buffer
  const decryptedBuffer = await decryptFileToBuffer(encryptedFilePath, iv, authTag);
  // console.log(decryptedBuffer)
  return decryptedBuffer;
};

const getPdfHandler = async (req, res, next) => {
  try {
    const decryptedBuffer = await getPdf(req.params.bookId);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Length": decryptedBuffer.length,
      "Content-Disposition": `inline; filename="book.pdf"`, // inline: mở trực tiếp, attachment: tải về
    });
    console.log(decryptedBuffer);
    res.send(decryptedBuffer); // gửi trực tiếp buffer
  } catch (err) {
    next(err);
  }
};



module.exports = {
  createBook,
  getAllBooks,
  getBookLock,
  getBookById,
  getBookByIdNoView,
  getAllBookById,
  updateCover,
  toggleBookStatus,
  deleteBook,
  getBooksByCategory,
  getTopViewedBooks,
  getPdf,
  getPdfHandler,
};

