import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SessionService } from '../../../services/session.service';
import { CourseService, Course } from '../../../services/course.service';
import { SidebaradminComponent } from '../../../components/sidebaradmin/sidebaradmin.component';
import { ProfileComponent } from '../../../components/profile/profile.component';
import html2canvas from 'html2canvas';
// Import jsPDF for PDF generation
import { jsPDF } from 'jspdf';
// Thêm import cho jsPDF-AutoTable
import autoTable from 'jspdf-autotable';

// Import html2canvas for HTML to image conversion
interface ChartData {
  label: string;
  value: number;
}

interface CourseStatistics {
  today: number;      // Khóa học tạo hôm nay
  thisWeek: number;   // Khóa học tạo tuần này  
  thisMonth: number;  // Khóa học tạo tháng này
  thisYear: number;   // Khóa học tạo năm này
  total: number;      // Tổng số khóa học
  byStatus: {         // Thống kê theo trạng thái
    published: number;
    archived: number;
    draft: number;
  };
  byCategory: ChartData[]; // Thống kê theo danh mục
}

@Component({
  selector: 'app-course-statistics',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebaradminComponent, ProfileComponent],
  templateUrl: './course-statistics.component.html',
  styleUrls: ['./course-statistics.component.scss']
})
export class CourseStatisticsComponent implements OnInit {
  // Make Math available in template
  Math = Math;
  
  // Authentication & Profile
  username: string = '';
  avatarUrl: string = '';

  // Loading & Error states
  loading = true;
  error: string | null = null;

  // Course data
  courses: Course[] = [];
  recentCourses: Course[] = [];

  // Statistics
  statistics: CourseStatistics = {
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
    thisYear: 0,
    total: 0,
    byStatus: {
      published: 0,
      archived: 0,
      draft: 0
    },
    byCategory: []
  };

  // Chart data
  monthlyCreations: ChartData[] = [];
  statusDistribution: ChartData[] = [];

  // Filters & Search
  searchTerm = '';
  selectedStatus = '';
  selectedCategory = '';
  selectedTimeFilter = '';

  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 0;
  totalCourses = 0;
  paginatedCourses: Course[] = [];
  filteredCourses: Course[] = [];

  // Sorting
  sortField = 'createdAt';
  sortDirection = 'desc';

  // Data quality tracking
  hasCreationDates = false;
  coursesWithoutDates = 0;

  constructor(
    private sessionService: SessionService,
    private courseService: CourseService
  ) {}

  ngOnInit() {
    this.loadUserInfo();
    this.loadCourseStatistics();
  }

  private loadUserInfo() {
    // Get username from session
    this.username = this.sessionService.getUsername() || 'Admin';
    
    // Try to get avatar from localStorage
    const avatarUrl = localStorage.getItem('avatarUrl');
    this.avatarUrl = avatarUrl || '';
  }

  async loadCourseStatistics() {
    this.loading = true;
    this.error = null;

    try {
      // Load all courses
      this.courses = await this.courseService.getCourses().toPromise() || [];

      // Check data quality
      this.checkDataQuality();

      // Generate statistics and charts
      this.generateStatistics();
      this.generateChartData();

      // Setup pagination
      this.setupAllCourses();

      // Get recent courses
      this.getRecentCourses();

    } catch (error) {
      this.error = 'Không thể tải dữ liệu thống kê khóa học';
    } finally {
      this.loading = false;
    }
  }

  private checkDataQuality() {
    this.hasCreationDates = this.courses.some(course => {
      const hasDate = this.getCourseCreationDate(course) !== null;
      return hasDate;
    });
    
    this.coursesWithoutDates = this.courses.filter(course => 
      this.getCourseCreationDate(course) === null
    ).length;
  }

  private generateStatistics() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    // Initialize statistics
    this.statistics = {
      today: 0,
      thisWeek: 0,
      thisMonth: 0,
      thisYear: 0,
      total: this.courses.length,
      byStatus: {
        published: 0,
        archived: 0,
        draft: 0
      },
      byCategory: []
    };

    // Calculate time-based statistics
    this.courses.forEach(course => {
      const creationDate = this.getCourseCreationDate(course);
      
      if (creationDate) {
        if (creationDate >= today) this.statistics.today++;
        if (creationDate >= weekStart) this.statistics.thisWeek++;
        if (creationDate >= monthStart) this.statistics.thisMonth++;
        if (creationDate >= yearStart) this.statistics.thisYear++;
      }

      // Status statistics - mapping old values to new ones for compatibility
      const status = course.status.toLowerCase();
      if (status === 'published' || status === 'active') this.statistics.byStatus.published++;
      else if (status === 'archived' || status === 'inactive') this.statistics.byStatus.archived++;
      else if (status === 'draft') this.statistics.byStatus.draft++;
    });

    // Category statistics (group by categoryId)
    const categoryMap = new Map<number, number>();
    this.courses.forEach(course => {
      const categoryId = course.categoryId;
      categoryMap.set(categoryId, (categoryMap.get(categoryId) || 0) + 1);
    });

    this.statistics.byCategory = Array.from(categoryMap.entries()).map(([categoryId, count]) => ({
      label: `Danh mục ${categoryId}`,
      value: count
    }));
  }

  private generateChartData(courses: Course[] = this.courses) {
    this.generateMonthlyChart(courses);
    this.generateStatusChart();
  }

  private generateMonthlyChart(courses: Course[]) {
    const currentYear = new Date().getFullYear();
    const months = [
      'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
      'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
    ];
    
    this.monthlyCreations = months.map((month, index) => {
      const monthStart = new Date(currentYear, index, 1);
      const monthEnd = new Date(currentYear, index + 1, 0);
      
      const count = courses.filter(course => {
        const creationDate = this.getCourseCreationDate(course);
        return creationDate && 
               creationDate >= monthStart && 
               creationDate <= monthEnd;
      }).length;
      
      return {
        label: month,
        value: count
      };
    });
  }

  private generateStatusChart() {
    this.statusDistribution = [
      { label: 'Published', value: this.statistics.byStatus.published },
      { label: 'Archived', value: this.statistics.byStatus.archived },
      { label: 'Draft', value: this.statistics.byStatus.draft }
    ];
  }

  private getCourseCreationDate(course: Course): Date | null {
    const courseAny = course as any;
    let creationDate: Date | null = null;

    // Try different possible field names
    const dateStr = courseAny.createdAt || 
                   courseAny.creationDate || 
                   courseAny.created_at || 
                   courseAny.createDate ||
                   courseAny.dateCreated ||
                   courseAny.createTime;

    if (dateStr) {
      creationDate = new Date(dateStr);
    }

    return creationDate && !isNaN(creationDate.getTime()) ? creationDate : null;
  }

  private getRecentCourses() {
    // Sort courses by creation date, then by ID
    const sortedCourses = [...this.courses].sort((a, b) => {
      const dateA = this.getCourseCreationDate(a);
      const dateB = this.getCourseCreationDate(b);
      
      if (dateA && dateB) {
        return dateB.getTime() - dateA.getTime();
      } else if (dateA) {
        return -1;
      } else if (dateB) {
        return 1;
      } else {
        return (b.courseId || 0) - (a.courseId || 0);
      }
    });

    this.recentCourses = sortedCourses.slice(0, 10);
  }

  private setupAllCourses() {
    this.totalCourses = this.courses.length;
    this.filteredCourses = [...this.courses];
    this.sortCourses();
    this.updatePagination();
  }

  // Filter methods
  filterByToday() {
    this.selectedTimeFilter = 'today';
    this.applyFilters();
  }

  filterByThisWeek() {
    this.selectedTimeFilter = 'thisWeek';
    this.applyFilters();
  }

  filterByThisMonth() {
    this.selectedTimeFilter = 'thisMonth';
    this.applyFilters();
  }

  filterByThisYear() {
    this.selectedTimeFilter = 'thisYear';
    this.applyFilters();
  }

  filterByTotal() {
    this.selectedTimeFilter = '';
    this.applyFilters();
  }

  filterByStatus(status: string) {
    // Toggle status filter - if same status clicked, clear filter
    if (this.selectedStatus === status) {
      this.selectedStatus = '';
    } else {
      this.selectedStatus = status;
    }
    this.applyFilters();
  }

  applyFilters() {
    let filtered = [...this.courses];

    // Apply time filter
    if (this.selectedTimeFilter) {
      const now = new Date();
      let startDate: Date;

      switch (this.selectedTimeFilter) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'thisWeek':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - now.getDay());
          break;
        case 'thisMonth':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'thisYear':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(0);
      }

      filtered = filtered.filter(course => {
        const creationDate = this.getCourseCreationDate(course);
        return creationDate && creationDate >= startDate;
      });
    }

    // Apply search filter
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(course => 
        course.title.toLowerCase().includes(term) ||
        course.description.toLowerCase().includes(term) ||
        course.status.toLowerCase().includes(term)
      );
    }

    // Apply status filter
    if (this.selectedStatus) {
      filtered = filtered.filter(course => {
        const courseStatus = course.status.toLowerCase();
        const selectedStatus = this.selectedStatus.toLowerCase();
        
        // Handle mapping between new and old status values
        if (selectedStatus === 'published') {
          return courseStatus === 'published' || courseStatus === 'active';
        } else if (selectedStatus === 'archived') {
          return courseStatus === 'archived' || courseStatus === 'inactive';
        } else if (selectedStatus === 'draft') {
          return courseStatus === 'draft';
        }
        
        return courseStatus === selectedStatus;
      });
    }

    // Apply category filter
    if (this.selectedCategory) {
      filtered = filtered.filter(course => 
        course.categoryId.toString() === this.selectedCategory
      );
    }

    this.filteredCourses = filtered;
    this.totalCourses = filtered.length;
    this.currentPage = 1;
    this.sortCourses();
    this.updatePagination();
  }

  onSearchChange() {
    this.applyFilters();
  }

  onStatusFilterChange() {
    this.applyFilters();
  }

  onCategoryFilterChange() {
    this.applyFilters();
  }

  // Sorting
  sortBy(field: string) {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'desc';
    }
    this.sortCourses();
    this.updatePagination();
  }

  private sortCourses() {
    this.filteredCourses.sort((a, b) => {
      let valueA: any;
      let valueB: any;

      switch (this.sortField) {
        case 'createdAt':
          valueA = this.getCourseCreationDate(a)?.getTime() || 0;
          valueB = this.getCourseCreationDate(b)?.getTime() || 0;
          break;
        case 'courseId':
          valueA = a.courseId || 0;
          valueB = b.courseId || 0;
          break;
        case 'title':
          valueA = a.title.toLowerCase();
          valueB = b.title.toLowerCase();
          break;
        case 'status':
          valueA = a.status.toLowerCase();
          valueB = b.status.toLowerCase();
          break;
        case 'price':
          valueA = a.price || 0;
          valueB = b.price || 0;
          break;
        default:
          valueA = (a as any)[this.sortField];
          valueB = (b as any)[this.sortField];
      }

      if (valueA < valueB) return this.sortDirection === 'asc' ? -1 : 1;
      if (valueA > valueB) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // Pagination
  updatePagination() {
    this.totalPages = Math.ceil(this.totalCourses / this.itemsPerPage);
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedCourses = this.filteredCourses.slice(startIndex, endIndex);
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePagination();
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  changeItemsPerPage(newSize: number) {
    this.itemsPerPage = newSize;
    this.currentPage = 1;
    this.updatePagination();
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const startPage = Math.max(1, this.currentPage - 2);
    const endPage = Math.min(this.totalPages, this.currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  }

  getMaxDisplayed(): number {
    return Math.min(this.currentPage * this.itemsPerPage, this.totalCourses);
  }

  getCourseDate(course: Course): string | undefined {
    const courseAny = course as any;
    
    // Try different possible field names
    return courseAny.createdAt || 
           courseAny.creationDate || 
           courseAny.created_at || 
           courseAny.createDate ||
           courseAny.dateCreated ||
           courseAny.createTime;
  }

  // Utility methods
  getTimeFilterLabel(): string {
    switch (this.selectedTimeFilter) {
      case 'today': return 'hôm nay';
      case 'thisWeek': return 'tuần này';
      case 'thisMonth': return 'tháng này';
      case 'thisYear': return 'năm này';
      default: return 'tất cả';
    }
  }

  clearFilters() {
    this.searchTerm = '';
    this.selectedStatus = '';
    this.selectedCategory = '';
    this.selectedTimeFilter = '';
    this.applyFilters();
  }

  getDisplayStatus(status: string): string {
    switch (status.toLowerCase()) {
      case 'published': 
      case 'active': return 'Published';
      case 'archived': 
      case 'inactive': return 'Archived';
      case 'draft': return 'Draft';
      default: return status;
    }
  }

  getMaxValue(data: ChartData[]): number {
    return Math.max(...data.map(item => item.value));
  }

  getBarHeight(value: number, maxValue: number): number {
    return maxValue > 0 ? (value / maxValue) * 100 : 0;
  }

  // Summary methods for charts
  getTotalMonthlyCreations(): number {
    return this.monthlyCreations.reduce((sum, item) => sum + item.value, 0);
  }

  getPeakMonthlyCreation(): ChartData {
    return this.monthlyCreations.reduce((peak, current) => 
      current.value > peak.value ? current : peak, 
      { label: '', value: 0 }
    );
  }

  getFormattedDate(dateString: string | undefined): string {
    if (!dateString) return 'Chưa có';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Không hợp lệ';
      
      return date.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Không hợp lệ';
    }
  }

  // Data export
  refreshData() {
    this.loadCourseStatistics();
  }

  exportStatistics() {
    const data = {
      timestamp: new Date().toISOString(),
      statistics: this.statistics,
      totalCourses: this.totalCourses,
      coursesWithoutDates: this.coursesWithoutDates,
      charts: {
        monthly: this.monthlyCreations,
        status: this.statusDistribution
      }
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `thong-ke-khoa-hoc-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // Export to PDF
async exportToPDF() {
  const element = document.getElementById('statistics-content');
  if (!element) {
    return;
  }

  const exportBtn = document.querySelector('.btn-pdf') as HTMLButtonElement;

  try {
    if (exportBtn) {
      exportBtn.disabled = true;
      exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xuất PDF...';
    }

    // === Chụp ảnh nội dung ===
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff'
    });
    const imgData = canvas.toDataURL('image/png');

    // === Chụp ảnh biểu đồ từ DOM (nếu có) ===
    // Sử dụng querySelector để lấy đúng phần tử canvas/chart (nên dùng class hoặc id của chart)
    let imgChartMonthly = '';
    let imgChartStatus = '';
    // Đảm bảo phần tử chart có id="chart-monthly" và id="chart-status" trong template
    const chartMonthlyEl = document.querySelector('#chart-monthly') as HTMLElement;
    const chartStatusEl = document.querySelector('#chart-status') as HTMLElement;
    if (chartMonthlyEl) {
      const chartMonthlyCanvas = await html2canvas(chartMonthlyEl, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#fff' });
      imgChartMonthly = chartMonthlyCanvas.toDataURL('image/png');
    }
    if (chartStatusEl) {
      const chartStatusCanvas = await html2canvas(chartStatusEl, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#fff' });
      imgChartStatus = chartStatusCanvas.toDataURL('image/png');
    }

    // === Hàm load font base64 ===
    const loadFontBase64 = async (path: string) => {
      const fontFile = await fetch(path);
      if (!fontFile.ok) {
        throw new Error(`Không tìm thấy font: ${path}`);
      }
      const buffer = await fontFile.arrayBuffer();
      return btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
    };

    // === Load 2 font cần dùng ===
    const [fontRegularBase64, fontBoldBase64] = await Promise.all([
      loadFontBase64('/assets/fonts/DejaVuSans.ttf'),
      loadFontBase64('/assets/fonts/DejaVuLGCSans-Bold.ttf')
    ]);

    // === Tạo PDF ===
    const pdf = new jsPDF('p', 'mm', 'a4');

    // Thêm font thường và font đậm cùng tên "DejaVuSans"
    (pdf as any).addFileToVFS('DejaVuSans.ttf', fontRegularBase64);
    (pdf as any).addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal');

    (pdf as any).addFileToVFS('DejaVuLGCSans-Bold.ttf', fontBoldBase64);
    (pdf as any).addFont('DejaVuLGCSans-Bold.ttf', 'DejaVuSans', 'bold');

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pdfWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

// === Cấu hình lề ===
const marginLeft = 30; // 3 cm
const marginRight = 20; // 2 cm
const marginTop = 20; // 2 cm
const marginBottom = 20; // 2 cm
const margin = 25
const topY = marginTop; // hoặc 20 nếu muốn 2cm

// === Kích thước trang ===
const pageWidth = pdf.internal.pageSize.getWidth();
const pageHeight = pdf.internal.pageSize.getHeight();
const centerX = pageWidth / 2;

// === Các khoảng cách dùng chung ===
const lineHeight = 7;

// === Tiêu đề quốc hiệu ở giữa ===
pdf.setFontSize(14);
pdf.setFont('DejaVuSans', 'bold');
pdf.text('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', centerX, marginTop, { align: 'center' });

pdf.setFontSize(13);
pdf.setFont('DejaVuSans', 'normal');
pdf.text('Độc lập - Tự do - Hạnh phúc', centerX, marginTop + lineHeight, { align: 'center' });

// === Ngày tháng căn phải ===
const today = new Date();
const formattedDate = `Hà Nội, ngày ${today.getDate().toString().padStart(2, '0')} tháng ${(today.getMonth() + 1)
  .toString()
  .padStart(2, '0')} năm ${today.getFullYear()}`;
pdf.text(formattedDate, pageWidth - marginRight, marginTop + lineHeight * 2 + 5, { align: 'right' });
let yPos = marginTop + 6 * lineHeight+10;
      // Tiêu đề chính
      pdf.setFontSize(14);
      pdf.setFont('DejaVuSans', 'bold');
      pdf.text('BÁO CÁO THỐNG KÊ SỐ KHÓA HỌC', centerX, topY + 3 * lineHeight + 20, { align: 'center' });

// Sau đó tiếp tục các phần khác (mục I, bảng...) và dùng marginLeft/marginRight để canh lề
let yPos2 = marginTop + 6 * lineHeight+40;


pdf.setFontSize(13);
pdf.setFont('DejaVuSans', 'bold');
pdf.text('I. TÓM TẮT THỐNG KÊ', marginLeft, yPos); 
yPos += lineHeight;

pdf.setFontSize(11);
pdf.setFont('DejaVuSans', 'normal');
pdf.text(`• Khóa học tạo hôm nay: ${this.statistics.today}`, margin + 5, yPos); yPos += lineHeight;
pdf.text(`• Khóa học tạo trong tuần: ${this.statistics.thisWeek}`, margin + 5, yPos); yPos += lineHeight;
pdf.text(`• Khóa học tạo trong tháng: ${this.statistics.thisMonth}`, margin + 5, yPos); yPos += lineHeight;
pdf.text(`• Khóa học tạo trong năm: ${this.statistics.thisYear}`, margin + 5, yPos); yPos += lineHeight;
pdf.text(`• Tổng số khóa học hiện có: ${this.statistics.total}`, margin + 5, yPos); yPos += lineHeight + 5;

// === Danh sách toàn bộ khóa học (ngay sau mục I, không sang trang mới) ===
let tableStartY = yPos + 10; // yPos là vị trí kết thúc mục tóm tắt
pdf.setFontSize(14);
pdf.setFont('DejaVuSans', 'bold');
pdf.text('II. DANH SÁCH TOÀN BỘ KHÓA HỌC', margin, tableStartY);

// Chuẩn bị dữ liệu cho bảng
const tableData = this.courses.map((course: any) => {
  const dateField = course.createdAt ||
                    course.creationDate ||
                    course.created_at ||
                    course.createDate ||
                    course.dateCreated ||
                    course.createTime;
  let createdAt = '';
  if (dateField) {
    const d = new Date(dateField);
    createdAt = !isNaN(d.getTime()) ? d.toLocaleDateString('vi-VN') : '';
  }
  return [
    String(course.courseId),
    course.title || '',
    course.status || '',
    createdAt
  ];
});

// Vẽ bảng với autoTable, bắt đầu ngay sau mục tóm tắt
autoTable(pdf, {
  head: [['ID', 'Tên khóa học', 'Trạng thái', 'Ngày tạo']],
  body: tableData,
  startY: tableStartY + 7,
  theme: 'grid',
  styles: {
    font: 'DejaVuSans',
    fontSize: 10,
    cellPadding: 3,
    halign: 'left',
    valign: 'middle',
  },
  headStyles: {
    fillColor: [74, 144, 226],
    textColor: 255,
    fontStyle: 'bold',
    halign: 'center'
  },
  columnStyles: {
    0: { cellWidth: 20, halign: 'center' },
    1: { cellWidth: 80 },
    2: { cellWidth: 30, halign: 'center' },
    3: { cellWidth: 30, halign: 'center' },
  },
   margin: { left: marginLeft, right: marginRight } // ← đảm bảo bảng cùng lề với mục I & II margin: { left: marginLeft, right: marginRight } // ← đảm bảo bảng cùng lề với mục I & II
});


// Footer cuối file
pdf.setFontSize(10);
pdf.setFont('DejaVuSans', 'italic');
pdf.text('CMC Learn - Learning Management System', centerX, pageHeight - 10, { align: 'center' });

// Lưu file PDF
const fileName = `bao-cao-thong-ke-khoa-hoc-${today.toISOString().split('T')[0]}.pdf`;
pdf.save(fileName);


  } catch (error: any) {
    alert(error?.message || 'Lỗi khi xuất PDF, vui lòng thử lại.');
  } finally {
    if (exportBtn) {
      exportBtn.disabled = false;
      exportBtn.innerHTML = '<i class="fas fa-file-pdf"></i> Xuất PDF';
    }
  }
}


  // Profile component event handlers
  onProfileUpdate() {
  }

  onLogout() {
    this.sessionService.logout();
  }
}

// Thêm chức năng xuất PDF cho danh sách khóa học đang hiển thị (theo bộ lọc/pagination)
export async function exportCoursesListToPDF(courses: Course[], username: string) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  pdf.setFont('courier', 'normal');
  const pdfWidth = pdf.internal.pageSize.getWidth();

  pdf.setFontSize(18);
  pdf.text('Course List Export', pdfWidth / 2, 20, { align: 'center' });

  pdf.setFontSize(12);
  pdf.text(`Exported by: ${username}`, pdfWidth / 2, 30, { align: 'center' });
  pdf.text(`Export date: ${new Date().toLocaleDateString('en-US')}`, pdfWidth / 2, 38, { align: 'center' });

  // Table header
  pdf.setFontSize(11);
  let y = 50;
  pdf.text('ID', 10, y);
  pdf.text('Title', 30, y);
  pdf.text('Status', 110, y);
  pdf.text('Created At', 140, y);

  pdf.setLineWidth(0.1);
  pdf.line(10, y + 2, pdfWidth - 10, y + 2);

  // Table rows
  y += 8;
  courses.forEach((course, idx) => {
    if (y > 280) {
      pdf.addPage();
      y = 20;
    }
    // Sử dụng hàm getCourseCreationDate nếu có
    let createdAt = '';
    if (typeof course === 'object' && course) {
      const date = (course as any).createdAt ||
                   (course as any).creationDate ||
                   (course as any).created_at ||
                   (course as any).createDate ||
                   (course as any).dateCreated ||
                   (course as any).createTime;
      if (date) {
        const d = new Date(date);
        createdAt = !isNaN(d.getTime()) ? d.toLocaleDateString('en-US') : '';
      }
    }
    pdf.text(String(course.courseId), 10, y);
    pdf.text(course.title, 30, y, { maxWidth: 70 });
    pdf.text(course.status, 110, y);
    pdf.text(createdAt, 140, y);
    y += 8;
  });

  pdf.setFontSize(10);
  pdf.text(`Total courses: ${courses.length}`, 10, y + 10);

  pdf.save(`danh-sach-khoa-hoc-${new Date().toISOString().split('T')[0]}.pdf`);
}