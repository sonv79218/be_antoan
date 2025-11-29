const jwt = require("jsonwebtoken");

const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET || "access_secret";
const REFRESH_TOKEN_SECRET =
  process.env.JWT_REFRESH_SECRET || "refresh_secret";

const signAccessToken = (user) => {
  const payload = { id: user._id, role: user.role };
  const token = jwt.sign(payload, ACCESS_TOKEN_SECRET, {
    expiresIn: "1d",
  });
  return token;
};

/**
 * Tạo refresh token JWT (expires in 1 year)
 */
const signRefreshToken = (user) => {
  const payload = { id: user._id };
  const token = jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: "1y" });
  console.log("🎫 JWT: Refresh token đã được tạo", {
    userId: user._id,
    tokenLength: token.length,
  });
  return token;
};

/**
 * Verify access token
 */
const verifyAccessToken = (token) => {
  try {
    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);
    return decoded;
  } catch (error) {
    console.error("❌ JWT: Access token verification failed", {
      error: error.name,
      message: error.message,
    });
    throw error;
  }
};

/**
 * Verify refresh token
 */
const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET);
    return decoded;
  } catch (error) {
    console.error("❌ JWT: Refresh token verification failed", {
      error: error.name,
      message: error.message,
    });
    throw error;
  }
};

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};

