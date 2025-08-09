# 🔐 Hướng dẫn Debug Authentication - LMS System

## ❌ Vấn đề hiện tại: HTTP 403 Forbidden

Khi gặp lỗi 403 Forbidden, có nghĩa là:
- Server từ chối quyền truy cập
- Token có thể hết hạn hoặc không hợp lệ
- Header Authorization không đúng format
- Server configuration có vấn đề

## 🔧 Các bước Debug Authentication

### 1. Kiểm tra Token trong Browser

Mở **Developer Tools** (F12) → **Console** và chạy:

```javascript
// Kiểm tra token trong localStorage
console.log('Token:', localStorage.getItem('token'));

// Decode token để xem payload
const token = localStorage.getItem('token');
if (token) {
  const payload = JSON.parse(atob(token.split('.')[1]));
  console.log('Token payload:', payload);
  console.log('Expires at:', new Date(payload.exp * 1000));
  console.log('Is expired:', new Date(payload.exp * 1000) < new Date());
}
```

### 2. Sử dụng Debug Tools trong App

1. **Vào trang Participant Statistics**
2. **Click nút "Test Auth"** để chạy diagnostic toàn diện
3. **Xem kết quả trong Console** (F12)

### 3. Kiểm tra Network Tab

1. **Mở Developer Tools** (F12)
2. **Vào tab Network**
3. **Refresh trang hoặc click "Làm mới dữ liệu"**
4. **Xem các request bị lỗi 403:**
   - Click vào request bị lỗi
   - Kiểm tra **Headers** tab
   - Xem **Authorization** header có đúng format không:
     ```
     Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
     ```

### 4. Test API Endpoints thủ công

Sử dụng **Postman** hoặc **curl** để test:

```bash
# Test với token hiện tại
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
     -H "Content-Type: application/json" \
     http://localhost:8080/api/users/me

# Test endpoint khác
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
     -H "Content-Type: application/json" \
     http://localhost:8080/api/courses
```

## 🛠️ Các cách khắc phục

### Cách 1: Làm mới Token

1. **Click nút "Test Auth"** trong app
2. **Xem console** để biết token có hết hạn không
3. **Nếu hết hạn:** App sẽ tự động thử refresh token

### Cách 2: Đăng nhập lại

Nếu refresh token thất bại:

1. **Logout** khỏi hệ thống
2. **Đăng nhập lại** để lấy token mới
3. **Test lại** các API endpoints

### Cách 3: Kiểm tra Server

Đảm bảo backend server:

1. **Đang chạy** trên port 8080
2. **CORS được config** đúng
3. **Authentication middleware** hoạt động bình thường

```bash
# Kiểm tra server có chạy không
curl http://localhost:8080/api/health

# Nếu không có health endpoint, thử:
curl http://localhost:8080
```

### Cách 4: Kiểm tra Database

Verify trong database:

```sql
-- Kiểm tra user có tồn tại và active không
SELECT * FROM users WHERE username = 'your_username';

-- Kiểm tra token có hợp lệ không (nếu server lưu token)
SELECT * FROM user_tokens WHERE user_id = your_user_id;
```

## 📋 Checklist Debug

- [ ] Token có tồn tại trong localStorage không?
- [ ] Token có hết hạn không?
- [ ] Headers Authorization có đúng format không?
- [ ] Server có đang chạy không?
- [ ] Network request có đi được đến server không?
- [ ] Server trả về status code gì?
- [ ] CORS có được config đúng không?
- [ ] User có quyền truy cập endpoint đó không?

## 🚨 Tình huống thường gặp

### 1. Token hết hạn
```
Token expires at: Sun Aug 02 2025 10:30:00 GMT+0700
Is expired: true
```
**Giải pháp:** Đăng nhập lại

### 2. Token format sai
```
Authorization: BearereyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
**Vấn đề:** Thiếu space sau "Bearer"
**Giải pháp:** Sửa interceptor

### 3. Server không chạy
```
ERR_CONNECTION_REFUSED
```
**Giải pháp:** Start backend server

### 4. CORS error
```
Access to XMLHttpRequest at 'http://localhost:8080/api/users/me' 
from origin 'http://localhost:4200' has been blocked by CORS policy
```
**Giải pháp:** Config CORS trên server

## 💡 Tips Debug

1. **Luôn kiểm tra Console** trước khi báo lỗi
2. **Sử dụng Network tab** để xem chi tiết request/response
3. **Test API bằng Postman** để loại trừ vấn đề frontend
4. **Kiểm tra server logs** để biết server nhận được gì
5. **So sánh với API documentation** để đảm bảo endpoint đúng

## 📞 Liên hệ hỗ trợ

Nếu vẫn không giải quyết được, cung cấp thông tin sau:

1. **Screenshot Console errors**
2. **Network tab screenshot** (request/response headers)
3. **Token payload** (che đi sensitive info)
4. **Server logs** (nếu có access)
5. **Steps to reproduce** the issue

---

**Chú ý:** Không share token thật trong logs hoặc screenshots vì lý do bảo mật!
