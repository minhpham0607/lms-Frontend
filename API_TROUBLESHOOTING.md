# Hướng dẫn khắc phục lỗi API

## Lỗi thường gặp và cách khắc phục

### 1. **Lỗi "Server API không hoạt động" (ECONNREFUSED)**

**Nguyên nhân:** Backend server chưa được khởi động hoặc không chạy trên port 8080.

**Cách khắc phục:**
1. Kiểm tra xem backend server có đang chạy không
2. Khởi động backend server trên port 8080
3. Kiểm tra URL: http://localhost:8080

### 2. **Lỗi "Kết nối timeout"**

**Nguyên nhân:** Server phản hồi quá chậm hoặc network có vấn đề.

**Cách khắc phục:**
1. Kiểm tra kết nối mạng
2. Restart backend server
3. Kiểm tra performance của database

### 3. **Lỗi "API endpoint không tìm thấy" (404)**

**Nguyên nhân:** Endpoints không tồn tại hoặc URL không đúng.

**Cách khắc phục:**
1. Kiểm tra backend có implement các endpoints sau không:
   - `GET /api/courses`
   - `GET /api/enrollments`
   - `GET /api/enrollments/statistics`
2. Kiểm tra cấu hình routing trong backend

### 4. **Lỗi "Không có quyền truy cập" (401/403)**

**Nguyên nhân:** Token hết hạn hoặc không có quyền.

**Cách khắc phục:**
1. Đăng nhập lại để lấy token mới
2. Kiểm tra quyền admin trong backend
3. Kiểm tra authentication middleware

## Cấu hình Backend Requirements

### Endpoints cần thiết:

```javascript
// 1. Lấy danh sách khóa học
GET /api/courses
Response: Course[]

// 2. Lấy danh sách enrollments
GET /api/enrollments  
Response: Enrollment[]

// 3. Lấy thống kê enrollments
GET /api/enrollments/statistics
Response: Statistics

// 4. Lấy khóa học của người dùng hiện tại (NEW)
GET /api/enrollments/my-courses
Response: EnrollmentsDTO[]
Headers: Authorization: Bearer <token>
```

### Response Models:

**EnrollmentsDTO Structure:**
```typescript
{
  enrollmentId: number;
  userId: number;
  courseId: number;
  courseTitle: string;
  courseName: string;
  enrolledAt: string;
  status: string;
  courseDescription?: string;
  instructorName?: string;
}
```

### Headers cần thiết:
```
Authorization: Bearer <token>
Content-Type: application/json
```

### CORS Configuration:
Backend cần cho phép CORS từ `http://localhost:4200`

## Kiểm tra nhanh

1. **Kiểm tra backend server:**
   ```bash
   curl http://localhost:8080/api/courses
   ```

2. **Kiểm tra với token:**
   ```bash
   curl -H "Authorization: Bearer <your-token>" http://localhost:8080/api/courses
   ```

3. **Kiểm tra trong browser:**
   Mở http://localhost:8080 để xem server có hoạt động không

## Lưu ý

- Đảm bảo backend server chạy trước khi mở frontend
- Token authentication phải được implement đúng cách
- Database connection phải ổn định
- Kiểm tra console logs của cả frontend và backend để debug

## Liên hệ

Nếu vẫn gặp lỗi, vui lòng:
1. Check console logs (F12 > Console)
2. Check network tab để xem API calls
3. Check backend server logs
