# Trang Thống kê Khóa học

## Tổng quan
Trang thống kê khóa học là một tính năng mới trong hệ thống LMS, cho phép admin xem và theo dõi số lượng khóa học được tạo theo các khoảng thời gian khác nhau và phân tích trạng thái khóa học dựa trên **dữ liệu thực** từ hệ thống.

## Tính năng chính

### 1. Thống kê tổng quan (Dữ liệu thực)
- **Tạo hôm nay**: Số khóa học được tạo trong ngày hiện tại
- **Tạo tuần này**: Số khóa học được tạo trong tuần hiện tại  
- **Tạo tháng này**: Số khóa học được tạo trong tháng hiện tại
- **Tạo năm này**: Số khóa học được tạo trong năm hiện tại
- **Tổng số khóa học**: Tổng số khóa học trong hệ thống

### 2. Thống kê theo trạng thái
- **Hoạt động**: Số khóa học đang hoạt động (status = 'active')
- **Không hoạt động**: Số khóa học không hoạt động (status = 'inactive')
- **Bản nháp**: Số khóa học ở trạng thái bản nháp (status = 'draft')

### 3. Biểu đồ thống kê (Dữ liệu thực)
- **Biểu đồ tạo khóa học hàng tuần**: Số lượng khóa học được tạo theo từng tuần trong tháng
- **Biểu đồ tạo khóa học hàng tháng**: Số lượng khóa học được tạo theo từng tháng trong năm
- **Biểu đồ phân bố trạng thái**: Phân bố khóa học theo trạng thái (Hoạt động, Không hoạt động, Bản nháp)

### 4. Danh sách tất cả khóa học với phân trang
- **Hiển thị đầy đủ**: Tất cả khóa học trong hệ thống với thông tin chi tiết
- **Phân trang thông minh**: Chia nhỏ dữ liệu với các tùy chọn 5, 10, 25, 50 mục/trang
- **Tìm kiếm nâng cao**: Tìm theo tên khóa học, mô tả
- **Bộ lọc đa tiêu chí**: Lọc theo trạng thái (Hoạt động, Không hoạt động, Bản nháp) và danh mục
- **Sắp xếp linh hoạt**: Sắp xếp theo ID, tên, giá, trạng thái, ngày tạo
- **Thống kê real-time**: Hiển thị số lượng kết quả tìm kiếm và vị trí hiện tại

### 5. Khóa học gần đây
- Hiển thị 10 khóa học được tạo gần đây nhất (sắp xếp theo ngày tạo thực)
- Thông tin bao gồm: thumbnail, tên khóa học, mô tả, danh mục, giá, **ngày tạo**, trạng thái
- Giao diện dạng card với hình ảnh và thông tin chi tiết

### 6. Thông báo chất lượng dữ liệu
- Hiển thị cảnh báo nếu thiếu thông tin ngày tạo khóa học
- Thống kê số lượng khóa học không có dữ liệu ngày tháng
- Hướng dẫn về độ chính xác của thống kê

### 7. Xuất dữ liệu
- **Xuất JSON**: Xuất dữ liệu thống kê thực dưới dạng file JSON
- **Xuất PDF**: Xuất báo cáo thống kê đầy đủ dưới dạng file PDF

## Nguồn dữ liệu

### API Endpoints được sử dụng:
1. **GET /api/courses/list** - Lấy danh sách tất cả khóa học
2. **GET /api/courses/statistics** - Lấy thống kê từ backend (fallback nếu không có)
3. **GET /api/courses/date-range** - Lấy khóa học theo khoảng thời gian

### Xử lý dữ liệu ngày tháng:
- **Ưu tiên 1**: `course.createdAt` (thời gian tạo khóa học)
- **Ưu tiên 2**: `course.creationDate` (ngày tạo khóa học)
- **Fallback**: Sắp xếp theo `courseId` (giả định ID cao hơn = mới hơn)

## Cách sử dụng

### Truy cập trang thống kê
1. Đăng nhập với tài khoản admin
2. Trong sidebar admin, click vào "Thống kê khóa học"
3. Hoặc truy cập trực tiếp URL: `/course-statistics`

### Quản lý danh sách khóa học
1. **Tìm kiếm**: Sử dụng ô tìm kiếm để tìm theo tên khóa học hoặc mô tả
2. **Lọc theo trạng thái**: Chọn Hoạt động, Không hoạt động, Bản nháp hoặc "Tất cả trạng thái"
3. **Lọc theo danh mục**: Chọn danh mục cụ thể hoặc "Tất cả danh mục"
4. **Phân trang**: Sử dụng các nút điều hướng hoặc chọn số mục hiển thị trên mỗi trang
5. **Xóa bộ lọc**: Click "Xóa bộ lọc" để reset tất cả tiêu chí tìm kiếm

### Đọc hiểu thống kê
- **Các số liệu có màu**: Dữ liệu chính xác dựa trên ngày tạo thực
- **Thông báo vàng**: Cảnh báo về chất lượng dữ liệu (nếu có)
- **Biểu đồ**: Phản ánh số liệu thực tế từ database

### Xuất báo cáo PDF
1. Trên trang thống kê, click nút "Xuất PDF"
2. Hệ thống sẽ tạo file PDF bao gồm:
   - Trang bìa với thông tin báo cáo
   - Thống kê tổng quan thực tế
   - Biểu đồ và phân tích chi tiết
   - Cảnh báo về chất lượng dữ liệu (nếu có)
   - Thông tin người xuất và thời gian

### Làm mới dữ liệu
- Click nút "Làm mới" để cập nhật dữ liệu thống kê mới nhất từ database

## Chất lượng dữ liệu

### Trường hợp lý tưởng:
- Tất cả khóa học có `createdAt` hoặc `creationDate`
- Thống kê hoàn toàn chính xác theo thời gian thực

### Trường hợp cần lưu ý:
- **Thiếu ngày tháng**: Một số khóa học không có thông tin ngày tạo
- **Dữ liệu không đầy đủ**: Thống kê theo thời gian có thể không phản ánh toàn bộ

### Hệ thống xử lý:
- Tự động phát hiện và báo cáo các vấn đề về dữ liệu
- Cung cấp thông tin về số lượng bản ghi có/không có ngày tháng
- Vẫn hiển thị thống kê tối đa có thể với dữ liệu hiện có

## Kỹ thuật

### Cải tiến so với phiên bản thống kê người dùng:
- ✅ **Dữ liệu thực**: Không còn sử dụng số ngẫu nhiên
- ✅ **Xử lý ngày tháng**: Hỗ trợ nhiều format và field
- ✅ **Kiểm tra chất lượng**: Thông báo về tình trạng dữ liệu
- ✅ **Sắp xếp thông minh**: Ưu tiên ngày tháng, fallback theo ID
- ✅ **API mở rộng**: Chuẩn bị cho thống kê từ backend
- ✅ **Phân trang**: Hiển thị tất cả khóa học với phân trang thông minh
- ✅ **Tìm kiếm & lọc**: Bộ lọc đa tiêu chí và tìm kiếm real-time
- ✅ **UX cải thiện**: Giao diện responsive, thông tin chi tiết
- ✅ **Thống kê trạng thái**: Phân tích theo trạng thái khóa học
- ✅ **Hiển thị khóa học**: Grid layout với thumbnail và thông tin chi tiết

### Course Interface được mở rộng:
```typescript
interface Course {
  courseId: number;
  title: string;
  description: string;
  categoryId: number;
  instructorId: number;
  status: string;
  price: number;
  thumbnailUrl: string;
  instructorImage?: string;
  createdAt?: string;        // ✅ Mới thêm
  creationDate?: string;     // ✅ Mới thêm
  updatedAt?: string;        // ✅ Mới thêm
}
```

### Methods mới được thêm:
- `getCourseStatistics()`: Lấy thống kê từ API
- `getCoursesByDateRange()`: Lấy khóa học theo khoảng thời gian
- `getCourseCreationDate()`: Parse ngày tạo khóa học
- `getFormattedDate()`: Format ngày tháng hiển thị
- `setupAllCourses()`: Khởi tạo dữ liệu cho phân trang
- `applyFilters()`: Áp dụng bộ lọc và tìm kiếm
- `goToPage()`, `nextPage()`, `previousPage()`: Điều hướng phân trang
- `changeItemsPerPage()`: Thay đổi số mục trên mỗi trang
- `clearFilters()`: Xóa tất cả bộ lọc
- `getDisplayStatus()`: Hiển thị trạng thái khóa học bằng tiếng Việt

### Tính năng phân trang:
```typescript
// Pagination properties
currentPage = 1;
itemsPerPage = 10;
totalPages = 0;
totalCourses = 0;

// Filter properties  
searchTerm = '';
selectedStatus = '';
selectedCategory = '';
```

## Lưu ý
- Tính năng này chỉ dành cho admin
- **Dữ liệu thống kê là thực tế** từ database
- Hệ thống tự động xử lý trường hợp thiếu dữ liệu ngày tháng
- Thông báo rõ ràng về chất lượng và độ tin cậy của thống kê
- Hỗ trợ responsive design cho mobile và tablet
- Tích hợp với hệ thống authentication và authorization
