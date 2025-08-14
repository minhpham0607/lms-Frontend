# Payment Integration Test Guide

## 🚀 Hướng dẫn test tích hợp Payment

### 1. Kiểm tra Backend đã chạy
```bash
cd c:\LMS\lms-Backend
./mvnw spring-boot:run
```
Backend sẽ chạy tại: http://localhost:8080

### 2. Kiểm tra Frontend đã chạy
```bash
cd c:\LMS\lms-Frontend
ng serve
```
Frontend sẽ chạy tại: http://localhost:4200

### 3. Test Flow Payment từ Course List

**Bước 1: Đăng nhập**
- Truy cập: http://localhost:4200/login
- Đăng nhập với tài khoản student

**Bước 2: Xem danh sách khóa học**
- Truy cập: http://localhost:4200/courses
- Tìm khóa học "Chưa đăng ký" có **giá > 0**

**Bước 3: Click vào khóa học có phí**
- Click vào khóa học có phí
- Payment Modal sẽ hiển thị
- Chọn phương thức thanh toán (VNPay)
- Click "Thanh toán ngay"

**Bước 4: Thanh toán VNPay**
- Sẽ mở tab mới với VNPay
- Sử dụng thẻ test: `9704198526191432198`
- OTP: `123456`

**Bước 5: Kiểm tra kết quả**
- Sau thanh toán, redirect về `/payment-success`
- Kiểm tra khóa học đã chuyển sang "Đã đăng ký"

### 4. Test Payment History
Truy cập: http://localhost:4200/payment-history
- ✅ Hiển thị lịch sử thanh toán
- ✅ Trạng thái payment chính xác

### 5. Test VNPay Configuration
Truy cập: http://localhost:4200/vnpay-test
- ✅ VNPay config hiển thị
- ✅ Test payment tạo URL thành công

### 6. Test Demo Payment
Truy cập: http://localhost:4200/payment-demo
- ✅ Modal payment hoạt động
- ✅ Tạo payment URL thành công

### 7. API Endpoints được sử dụng
- `POST /api/payments/create` - Tạo thanh toán thường
- `POST /api/payments/vnpay` - Tạo thanh toán VNPay
- `GET /api/payments/history` - Lịch sử thanh toán
- `GET /api/payments/vnpay-callback` - Xử lý callback VNPay

### 8. VNPay Test Cards
**NCB Bank:** 9704198526191432198 - NGUYEN VAN A - 07/15
**Techcombank:** 9704061006060005047 - NGUYEN VAN A - 11/19
**OTP SMS:** 123456

### 9. Features đã tích hợp

✅ **Phân biệt khóa học có phí/miễn phí**
- Khóa học miễn phí: Đăng ký trực tiếp
- Khóa học có phí: Hiển thị Payment Modal

✅ **Payment Modal trong Course List**
- Click vào khóa học có phí → hiển thị modal
- Chọn phương thức thanh toán
- Tạo VNPay payment URL

✅ **UI/UX enhancements**
- Badge "Có phí"/"Miễn phí"
- Button "Thanh toán & Đăng ký"
- Hover effects và styling

✅ **Links trong Sidebar**
- "Thanh toán" → Payment History
- "Demo Payment" → Payment Demo

### 10. Troubleshooting
- **Modal không hiển thị**: Kiểm tra console errors
- **VNPay không hoạt động**: Kiểm tra VNPay config
- **Course không update**: Reload trang sau thanh toán
