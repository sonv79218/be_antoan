const bookService = require("../services/book.service");

const handleError = (res, error) =>
  res
    .status(error.statusCode || 500)
    .json({ message: error.message || "Lỗi server" });

// Controller: nhận req/res và uỷ quyền cho bookService xử lý tạo sách.
const createBook = async (req, res) => {
  try {
    const result = await bookService.createBook(
      req.body,
      req.files,
      // req.chapters
    );
    return res.status(201).json(result);
  } catch (error) {
    return handleError(res, error);
  }
};



const getAllBooks = async (req, res) => {
  try {
    // Check if client wants decrypted content (query param: ?includeContent=true)
    const includeContent = req.query.includeContent === "true";
    const result = await bookService.getAllBooks(includeContent);
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error);
  }
};

const getBookLock = async (req, res) => {
  try {
    const result = await bookService.getBookLock();
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error);
  }
};

const getBookById = async (req, res) => {
  try {
    const result = await bookService.getBookById(req.params.id);
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error);
  }
};

const getBookByIdNoView = async (req, res) => {
  try {
    const result = await bookService.getBookByIdNoView(req.params.id);
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error);
  }
};

const getAllBookById = async (req, res) => {
  try {
    const result = await bookService.getAllBookById(req.params.id);
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error);
  }
};

const updateCover = async (req, res) => {
  try {
    const result = await bookService.updateCover(req.params.id, req.file);
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error);
  }
};

const toggleBookStatus = async (req, res) => {
  try {
    const result = await bookService.toggleBookStatus(req.params.id);
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error);
  }
};

const deleteBook = async (req, res) => {
  try {
    const result = await bookService.deleteBook(req.params.id);
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error);
  }
};

const getBooksByCategory = async (req, res) => {
  try {
    // Check if client wants decrypted content (query param: ?includeContent=true)
    const includeContent = req.query.includeContent === "true";
    const result = await bookService.getBooksByCategory(
      req.params.categoryId,
      includeContent
    );
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error);
  }
};

const getTopViewedBooks = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 5;
    // Check if client wants decrypted content (query param: ?includeContent=true)
    const includeContent = req.query.includeContent === "true";
    const result = await bookService.getTopViewedBooks(limit, includeContent);
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error);
  }
};

const getPdf = async (req, res) => {
  try {
    const buffer = await bookService.getPdf(req.params.id);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="book.pdf"`);

    return res.send(buffer);
  } catch (error) {
    return handleError(res, error);
  }
};

const getPdfHandler = async (req, res) => {
  try {
    const buffer = await bookService.getPdfHandler(req.params.id);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="book.pdf"`);

    return res.send(buffer);
  } catch (error) {
    return handleError(res, error);
  }
}


module.exports = {
  createBook,
  getAllBooks,
  getBookLock,
  getBookById,
  getAllBookById,
  updateCover,
  toggleBookStatus,
  deleteBook,
  getBooksByCategory,
  getTopViewedBooks,
  getBookByIdNoView,
  getPdf,
  getPdfHandler,
};
