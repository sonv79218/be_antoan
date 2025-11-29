const authService = require("../services/auth.service");

const handleError = (res, error) => {
  const statusCode = error.statusCode || 500;
  const message = error.message || "Lỗi server";
};

// Controller: chỉ nhận request, gọi authService xử lý và trả kết quả.
exports.register = async (req, res) => {
  try {
    const result = await authService.registerUser(req.body);
    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// Controller: chỉ uỷ quyền đăng nhập cho authService.
exports.login = async (req, res) => {
  try {
    const result = await authService.loginUser(req.body);
    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const result = await authService.refreshAccessToken(req.body.refreshToken);
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error);
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const result = await authService.getAllUsers();
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error);
  }
};

exports.getUserById = async (req, res) => {
  try {
    const result = await authService.getUserById(req.params.id);
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error);
  }
};

exports.toggleUserStatus = async (req, res) => {
  try {
    const io = req.app.get("io");
    const result = await authService.toggleUserStatus(req.params.id, io);
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error);
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const result = await authService.updateProfile(req.user.id, req.body, req.file);
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error);
  }
};

exports.changePassword = async (req, res) => {
  try {
    const result = await authService.changePassword(req.user.id, req.body);
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error);
  }
};
