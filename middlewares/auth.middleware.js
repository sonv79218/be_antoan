const User = require("../models/user");
const { verifyAccessToken } = require("../utils/jwt");

/**
 * JWT Authentication Middleware
 * - Đọc token từ header Authorization: Bearer <JWT>
 * - Giải mã và kiểm tra token hợp lệ, chưa hết hạn
 * - Nếu hợp lệ: gắn user vào req.user và tiếp tục
 * - Nếu không hợp lệ: trả 401/403 tùy loại lỗi
 */
const authMiddleware = async (req, res, next) => {
  try {
    // 1. Lấy token từ header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Thiếu token xác thực. Vui lòng đăng nhập.",
      });
    }

    // 2. Kiểm tra format Bearer <token>
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Định dạng token không hợp lệ. Sử dụng: Bearer <token>",
      });
    }

    // 3. Tách token từ header
    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token không được cung cấp.",
      });
    }

    // 4. Giải mã và kiểm tra token
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (error) {
      // Phân biệt các loại lỗi JWT
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Token đã hết hạn. Vui lòng đăng nhập lại.",
          code: "TOKEN_EXPIRED",
        });
      }
      if (error.name === "JsonWebTokenError") {
        return res.status(403).json({
          success: false,
          message: "Token không hợp lệ.",
          code: "INVALID_TOKEN",
        });
      }
      // Lỗi khác
      return res.status(403).json({
        success: false,
        message: "Token không hợp lệ hoặc đã bị hủy.",
        code: "TOKEN_ERROR",
      });
    }

    // 5. Kiểm tra user còn tồn tại trong DB
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Người dùng không tồn tại hoặc đã bị xóa.",
        code: "USER_NOT_FOUND",
      });
    }

    // 6. Kiểm tra tài khoản còn active không
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.",
        code: "ACCOUNT_DISABLED",
      });
    }

    // 7. Gắn user vào request để các route sau sử dụng
    req.user = {
      ...user.toObject(),
      id: user._id.toString(),
    };

    // 8. Tiếp tục xử lý request
    next();
  } catch (error) {
    // Lỗi không mong đợi
    console.error("Auth middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi xác thực. Vui lòng thử lại sau.",
      code: "AUTH_ERROR",
    });
  }
};

module.exports = authMiddleware;
