import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SessionService } from '../../../services/session.service';
import { CourseService, Course } from '../../../services/course.service';
import { SidebaradminComponent } from '../../../components/sidebaradmin/sidebaradmin.component';
import { ProfileComponent } from '../../../components/profile/profile.component';
// Import jsPDF for PDF generation
declare var jsPDF: any;
// Import html2canvas for HTML to image conversion
declare var html2canvas: any;

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
  userRole: string = '';

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
    
    // Get user role from session
    this.userRole = this.sessionService.getUserRole() || 'admin';
    
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
      console.log('🔍 Loaded courses data:', this.courses);
      console.log('🔍 Sample course:', this.courses[0]); // Log first course to see structure

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
      console.error('Error loading course statistics:', error);
      this.error = 'Không thể tải dữ liệu thống kê khóa học';
    } finally {
      this.loading = false;
    }
  }

  private checkDataQuality() {
    this.hasCreationDates = this.courses.some(course => {
      const hasDate = this.getCourseCreationDate(course) !== null;
      if (!hasDate) {
        console.log('🔍 Course without date:', course.courseId, course.title);
      }
      return hasDate;
    });
    
    this.coursesWithoutDates = this.courses.filter(course => 
      this.getCourseCreationDate(course) === null
    ).length;

    console.log('🔍 Data quality check:', {
      totalCourses: this.courses.length,
      hasCreationDates: this.hasCreationDates,
      coursesWithoutDates: this.coursesWithoutDates
    });
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
    console.log('🔍 Getting date for course:', course.courseId, {
      createdAt: courseAny.createdAt,
      creationDate: courseAny.creationDate,
      created_at: courseAny.created_at,
      createDate: courseAny.createDate,
      allFields: Object.keys(courseAny)
    });
    
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
      console.error('Element not found for PDF export');
      return;
    }

    try {
      // Show loading state
      const exportBtn = document.querySelector('.btn-pdf') as HTMLButtonElement;
      if (exportBtn) {
        exportBtn.disabled = true;
        exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xuất PDF...';
      }

      // Configure html2canvas options
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      // Calculate dimensions
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth - 20; // 10mm margin on each side
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Add title page
      pdf.setFontSize(20);
      pdf.text('Báo cáo thống kê khóa học', 105, 30, { align: 'center' });
      
      pdf.setFontSize(12);
      pdf.text(`Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}`, 105, 45, { align: 'center' });
      pdf.text(`Người xuất: ${this.username}`, 105, 55, { align: 'center' });

      // Add summary statistics
      pdf.setFontSize(14);
      pdf.text('Tóm tắt thống kê:', 20, 80);
      
      pdf.setFontSize(11);
      let yPos = 95;
      pdf.text(`• Tạo hôm nay: ${this.statistics.today} khóa học`, 25, yPos);
      yPos += 10;
      pdf.text(`• Tạo tuần này: ${this.statistics.thisWeek} khóa học`, 25, yPos);
      yPos += 10;
      pdf.text(`• Tạo tháng này: ${this.statistics.thisMonth} khóa học`, 25, yPos);
      yPos += 10;
      pdf.text(`• Tạo năm này: ${this.statistics.thisYear} khóa học`, 25, yPos);
      yPos += 10;
      pdf.text(`• Tổng số khóa học: ${this.statistics.total} khóa học`, 25, yPos);

      // Add new page for charts
      pdf.addPage();
      
      // Add the main content image
      pdf.addImage(imgData, 'PNG', 0, 10, imgWidth, imgHeight);
      let heightLeft = imgHeight;

      // Add more pages if needed
      while (heightLeft >= pdfHeight) {
        heightLeft -= pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, -(pdfHeight - heightLeft - 10), imgWidth, imgHeight);
      }

      // Add footer
      if (heightLeft < pdfHeight - 50) {
        pdf.text('CMC Learn - Hệ thống quản lý học tập', 105, 290, { align: 'center' });
      }

      // Save the PDF
      const fileName = `thong-ke-khoa-hoc-${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

      // Reset button state
      if (exportBtn) {
        exportBtn.disabled = false;
        exportBtn.innerHTML = '<i class="fas fa-file-pdf"></i> Xuất PDF';
      }

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Có lỗi xảy ra khi xuất PDF. Vui lòng thử lại.');
      
      // Reset button state
      const exportBtn = document.querySelector('.btn-pdf') as HTMLButtonElement;
      if (exportBtn) {
        exportBtn.disabled = false;
        exportBtn.innerHTML = '<i class="fas fa-file-pdf"></i> Xuất PDF';
      }
    }
  }

  // Profile component event handlers
  onProfileUpdate() {
    console.log('Profile update requested');
  }

  onLogout() {
    this.sessionService.logout();
  }

  getDisplayRole(role: string): string {
    switch (role?.toLowerCase()) {
      case 'admin': return 'Quản trị viên';
      case 'instructor': return 'Giảng viên';
      case 'student': return 'Học viên';
      default: return role || 'Admin';
    }
  }
}
