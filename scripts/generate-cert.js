const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

/**
 * Script tạo self-signed certificate cho HTTPS localhost
 * Chạy: node scripts/generate-cert.js
 */

const certDir = path.join(__dirname, "..", "certs");
const keyPath = path.join(certDir, "key.pem");
const certPath = path.join(certDir, "cert.pem");

// Tạo thư mục certs nếu chưa có
if (!fs.existsSync(certDir)) {
  fs.mkdirSync(certDir, { recursive: true });
  console.log("✅ Đã tạo thư mục certs/");
}

// Kiểm tra xem đã có certificate chưa
if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  console.log("⚠️  Certificate đã tồn tại. Xóa file cũ để tạo mới.");
  process.exit(0);
}

try {
  // Tạo self-signed certificate với OpenSSL
  // Valid trong 365 ngày, cho localhost và 127.0.0.1
  const command = `openssl req -x509 -newkey rsa:4096 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/C=VN/ST=Hanoi/L=Hanoi/O=Local/OU=Dev/CN=localhost" -addext "subjectAltName=DNS:localhost,DNS:*.localhost,IP:127.0.0.1"`;

  console.log("🔐 Đang tạo self-signed certificate...");
  execSync(command, { stdio: "inherit" });

  console.log("✅ Đã tạo certificate thành công!");
  console.log(`   Key: ${keyPath}`);
  console.log(`   Cert: ${certPath}`);
  console.log("\n⚠️  Lưu ý: Self-signed certificate sẽ hiển thị cảnh báo trên trình duyệt.");
  console.log("   Đây là bình thường cho môi trường development.");
} catch (error) {
  console.error("❌ Lỗi tạo certificate:", error.message);
  console.log("\n💡 Hướng dẫn:");
  console.log("   1. Cài đặt OpenSSL: https://www.openssl.org/");
  console.log("   2. Hoặc dùng WSL (Windows) / Terminal (Mac/Linux)");
  console.log("   3. Chạy lại script này");
  process.exit(1);
}


