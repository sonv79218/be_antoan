# 🔒 Hướng dẫn Bảo mật

## 1. HTTPS Configuration

### Localhost (Development)

1. **Tạo self-signed certificate:**
   ```bash
   npm run generate-cert
   ```
   Hoặc:
   ```bash
   node scripts/generate-cert.js
   ```

2. **Certificate sẽ được tạo trong thư mục `certs/`:**
   - `certs/key.pem` - Private key
   - `certs/cert.pem` - Certificate

3. **Bật HTTPS trong `.env`:**
   ```env
   USE_HTTPS=true
   ```

4. **Lưu ý:** Self-signed certificate sẽ hiển thị cảnh báo trên trình duyệt. Đây là bình thường cho development.

### Production (Cloud)

- Giả định HTTPS đã được cấu hình bởi reverse proxy (nginx, Cloudflare, AWS ALB, etc.)
- Hoặc cấu hình certificate qua biến môi trường:
  ```env
  NODE_ENV=production
  USE_HTTPS=true
  SSL_KEY=<path-to-key>
  SSL_CERT=<path-to-cert>
  ```

## 2. JWT Middleware

### Cách sử dụng

Middleware JWT đã được cải thiện với xử lý lỗi chi tiết:

```javascript
const auth = require("./middlewares/auth.middleware");

// Áp dụng cho route cụ thể
router.get("/protected", auth, controller.getData);

// Áp dụng cho nhiều routes
router.use(auth);
router.get("/profile", controller.getProfile);
router.patch("/update", controller.update);
```

### Xử lý lỗi

Middleware trả về các mã lỗi cụ thể:

- **401 Unauthorized:**
  - Thiếu token
  - Token hết hạn (`TOKEN_EXPIRED`)
  - User không tồn tại (`USER_NOT_FOUND`)

- **403 Forbidden:**
  - Token không hợp lệ (`INVALID_TOKEN`)
  - Tài khoản bị khóa (`ACCOUNT_DISABLED`)

### Ví dụ request

```bash
# Header cần thiết
Authorization: Bearer <JWT_TOKEN>
```

### Response khi lỗi

```json
{
  "success": false,
  "message": "Token đã hết hạn. Vui lòng đăng nhập lại.",
  "code": "TOKEN_EXPIRED"
}
```

## 3. Áp dụng Middleware cho các API hiện có

### Ví dụ: Bảo vệ route book

```javascript
// routes/book.js
const auth = require("../middlewares/auth.middleware");

// Chỉ admin mới tạo được sách
router.post("/create-book", auth, isAdmin, bookController.createBook);

// User đã đăng nhập mới xem được chi tiết
router.get("/get-detail/:id", auth, bookController.getBookById);
```

### Ví dụ: Bảo vệ toàn bộ routes

```javascript
// routes/comment.js
const auth = require("../middlewares/auth.middleware");

// Tất cả routes trong file này đều cần auth
router.use(auth);

router.post("/", commentController.createComment);
router.get("/book/:bookId", commentController.getCommentsByBook);
```

## 4. Biến môi trường

Thêm vào `.env`:

```env
# JWT
JWT_SECRET=your_secret_key_here
JWT_REFRESH_SECRET=your_refresh_secret_key_here

# HTTPS (optional)
USE_HTTPS=true
NODE_ENV=production
```

## 5. Testing

### Test JWT Middleware

```bash
# 1. Đăng nhập để lấy token
curl -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# 2. Sử dụng token để truy cập protected route
curl http://localhost:5000/book/get-detail/123 \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

### Test HTTPS

```bash
# Với self-signed cert, cần thêm flag -k để bỏ qua SSL verification
curl -k https://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'
```

## 6. Lưu ý bảo mật

1. **Không commit certificate vào Git:**
   - Thêm `certs/` vào `.gitignore`
   - Certificate chỉ dùng cho localhost development

2. **Production:**
   - Sử dụng certificate từ CA (Let's Encrypt, AWS Certificate Manager, etc.)
   - Hoặc để reverse proxy xử lý HTTPS

3. **JWT Secret:**
   - Sử dụng secret key mạnh (ít nhất 32 ký tự)
   - Không commit secret vào code
   - Sử dụng biến môi trường


