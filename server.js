const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();
const authRoutes = require("./routes/auth.js");
const bookRoutes = require("./routes/book");
const categoryRoutes = require("./routes/category");
const bookmarkRoutes = require("./routes/bookmark");
const favoriteRoutes = require("./routes/favorite");
const commentRoutes = require("./routes/comment");
const reportRoutes = require("./routes/report");
const chatRoutes = require("./routes/chat");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const http = require("http");
const https = require("https");
const { Server } = require("socket.io");

const app = express();

// Cấu hình HTTPS (cho localhost với self-signed cert hoặc production)
let server;
const isProduction = process.env.NODE_ENV === "production";
const useHttps = process.env.USE_HTTPS === "true" || isProduction;

if (useHttps) {
  const certDir = path.join(__dirname, "certs");
  const keyPath = path.join(certDir, "key.pem");
  const certPath = path.join(certDir, "cert.pem");

  // Kiểm tra certificate có tồn tại không
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    const httpsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
    server = https.createServer(httpsOptions, app);
    console.log("🔐 Server chạy với HTTPS (self-signed certificate)");
  } else if (isProduction) {
    // Production: giả định certificate được cấu hình bởi reverse proxy (nginx, cloudflare, etc.)
    // Hoặc có thể đọc từ biến môi trường
    if (process.env.SSL_KEY && process.env.SSL_CERT) {
      const httpsOptions = {
        key: process.env.SSL_KEY,
        cert: process.env.SSL_CERT,
      };
      server = https.createServer(httpsOptions, app);
      console.log("🔐 Server chạy với HTTPS (production certificate)");
    } else {
      // Fallback HTTP nếu không có cert trong production (giả định có reverse proxy)
      server = http.createServer(app);
      console.log("⚠️  Server chạy với HTTP (giả định có reverse proxy HTTPS)");
    }
  } else {
    // Localhost không có cert: fallback HTTP
    server = http.createServer(app);
    console.log("⚠️  Không tìm thấy certificate. Chạy HTTP.");
    console.log("💡 Chạy: node scripts/generate-cert.js để tạo self-signed certificate");
  }
} else {
  // Chạy HTTP nếu không bật HTTPS
  server = http.createServer(app);
  console.log("🌐 Server chạy với HTTP");
}

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

app.set("io", io);

app.use((req, res, next) => {
  req.io = io;
  next();
});

io.on("connection", (socket) => {
  console.log("client connected", socket.id);

  socket.on("send-message", (data) => {
    io.emit("receive-message", data);
  });

  // phòng chat riêng cho comment theo từng sách
  socket.on("join-book", (book) => {
    socket.join(book);
    console.log(`📚 Client ${socket.id} đã vào phòng sách ${book}`);
  });

  // kênh chat chung (di chuyển vào đây)
  socket.on("sendMessage", (msg) => {
    io.emit("newMessage", {
      socketId: socket.id,
      ...msg,
    });
  });

  socket.on("disconnect", () => {
    console.log("client disconnected", socket.id);
  });
});


app.use(cors());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/auth", authRoutes);
app.use("/book", bookRoutes);
app.use("/category", categoryRoutes);
app.use("/bookmark", bookmarkRoutes);
app.use("/favorite", favoriteRoutes);
app.use("/comment", commentRoutes);
app.use("/report", reportRoutes);
app.use("/chat", chatRoutes);

const PORT = process.env.PORT || 5000;
const PROTOCOL = useHttps && server instanceof https.Server ? "https" : "http";

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on ${PROTOCOL}://localhost:${PORT}`);
      if (useHttps && server instanceof https.Server) {
        console.log("🔒 HTTPS enabled - Secure connection");
      }
    });
  })
  .catch((err) => console.error("❌ MongoDB connection error:", err));
