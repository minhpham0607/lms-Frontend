import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SessionService } from '../../../services/session.service';
import { CourseService, Course, Enrollment } from '../../../services/course.service';
import { UserService } from '../../../services/user.service';
import { SidebaradminComponent } from '../../../components/sidebaradmin/sidebaradmin.component';
import { SidebarComponent } from '../../../components/sidebar/sidebar.component';
import { ProfileComponent } from '../../../components/profile/profile.component';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import autoTable from 'jspdf-autotable';

interface ParticipantStatistics {
  totalParticipants: number;
  todayEnrollments: number;
  thisWeekEnrollments: number;
  thisMonthEnrollments: number;
  thisYearEnrollments: number;
  averagePerCourse: number;
  enrollmentsByMonth: ChartData[];
  enrollmentsByCourse: ChartData[];
  enrollmentsByCategory: ChartData[];
  topCourses: TopCourseData[];
  recentEnrollments: EnrollmentData[];
}

interface ChartData {
  label: string;
  value: number;
}

interface TopCourseData {
  courseId: number;
  title: string;
  enrollmentCount: number;
  categoryId: number;
}

interface EnrollmentData {
  enrollmentId: number | string;
  userId: number;
  courseId: number;
  courseTitle: string;
  enrolledAt: string;
  status: string;
  // Thông tin bổ sung từ UserDTO
  username?: string;
  email?: string;
  fullName?: string;
}

interface EnrollmentsDTO {
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

@Component({
  selector: 'app-participant-statistics',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebaradminComponent, SidebarComponent, ProfileComponent],
  templateUrl: './participant-statistics.component.html',
  styleUrls: ['./participant-statistics.component.scss']
})
export class ParticipantStatisticsComponent implements OnInit {
  // Make Math available in template
  Math = Math;
  
  // Authentication & Profile
  username: string = '';
  avatarUrl: string = '';

  // Role-based access control
  userRole: string = '';
  currentUserId: number | null = null;
  isInstructor: boolean = false;
  isAdmin: boolean = false;

  // Loading & Error states
  loading = true;
  error: string | null = null;
  isUsingRealData = false;
  dataSource = 'Đang tải dữ liệu từ API...';

  // Participant data
  enrollments: EnrollmentData[] = [];
  courses: Course[] = [];

  // Statistics
  statistics: ParticipantStatistics = {
    totalParticipants: 0,
    todayEnrollments: 0,
    thisWeekEnrollments: 0,
    thisMonthEnrollments: 0,
    thisYearEnrollments: 0,
    averagePerCourse: 0,
    enrollmentsByMonth: [],
    enrollmentsByCourse: [],
    enrollmentsByCategory: [],
    topCourses: [],
    recentEnrollments: []
  };

  // Chart data
  monthlyEnrollments: ChartData[] = [];
  courseEnrollments: ChartData[] = [];
  categoryEnrollments: ChartData[] = [];

  // Filters & Search
  searchTerm = '';
  selectedCourse = '';
  selectedCategory = '';
  selectedTimeFilter = '';

  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 0;
  totalEnrollments = 0;
  paginatedEnrollments: EnrollmentData[] = [];
  filteredEnrollments: EnrollmentData[] = [];

  // Sorting
  sortField = 'enrolledAt';
  sortDirection = 'desc';

  // Course participants modal
  showParticipantsModal = false;
  selectedCourseForParticipants: Course | null = null;
  courseParticipants: EnrollmentData[] = [];
  loadingParticipants = false;
  participantsError: string | null = null;

  // Instructor-specific statistics
  instructorStats = {
    totalMyCourses: 0,
    coursesWithStudents: 0,
    coursesWithoutStudents: 0,
    averageStudentsPerCourse: 0,
    maxStudentsInCourse: 0,
    minStudentsInCourse: 0,
    mostPopularCourse: '',
    leastPopularCourse: ''
  };

  // Course statistics modal
  showCourseStatsModal = false;
  selectedStatType: string = '';
  selectedStatTitle: string = '';
  courseStatsList: Course[] = [];
  loadingCourseStats = false;
  courseStatsError: string | null = null;

  constructor(
    private sessionService: SessionService,
    private courseService: CourseService,
    private userService: UserService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    this.loadUserInfo();
    this.loadParticipantStatistics();
  }

  private loadUserInfo() {
    
    // Get username from session service
    const sessionUsername = this.sessionService.getUsername();
    
    this.username = sessionUsername || 'Admin';
    const avatarUrl = localStorage.getItem('avatarUrl');
    this.avatarUrl = avatarUrl || '';
    
    // Parse JWT token to get user role and ID
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('token');
      
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          
          // Try to get username from token if session service failed
          if (!sessionUsername && payload) {
            this.username = payload.sub || payload.username || payload.email || 'User';
          }
          
          // Robust role detection
          this.userRole = payload.role || payload.roles || payload.authorities || 'instructor';
          this.currentUserId = payload.userId || payload.sub || payload.id;
          
          // Explicit role checking
          if (Array.isArray(payload.roles)) {
            this.isAdmin = payload.roles.includes('admin') || payload.roles.includes('ADMIN') || 
                          payload.roles.includes('ROLE_ADMIN') || payload.roles.includes('ROLE_admin');
            this.isInstructor = payload.roles.includes('instructor') || payload.roles.includes('INSTRUCTOR') ||
                               payload.roles.includes('ROLE_INSTRUCTOR') || payload.roles.includes('ROLE_instructor');
          } else if (Array.isArray(payload.authorities)) {
            this.isAdmin = payload.authorities.includes('admin') || payload.authorities.includes('ADMIN') ||
                          payload.authorities.includes('ROLE_ADMIN') || payload.authorities.includes('ROLE_admin');
            this.isInstructor = payload.authorities.includes('instructor') || payload.authorities.includes('INSTRUCTOR') ||
                               payload.authorities.includes('ROLE_INSTRUCTOR') || payload.authorities.includes('ROLE_instructor');
          } else {
            // Check the single role field for various formats
            const roleString = this.userRole.toLowerCase();
            this.isAdmin = roleString.includes('admin');
            this.isInstructor = roleString.includes('instructor');
          }
          
          // Ensure no overlap - instructor should not be admin
          if (this.isInstructor && this.isAdmin) {
            this.isAdmin = false;
          }
          
          // Final validation
          if (!this.currentUserId) {
            throw new Error('User ID not found in token');
          }
          
          if (!this.isAdmin && !this.isInstructor) {
            this.isInstructor = true;
          }
          
        } catch (error) {
          // Fallback to default instructor role
          this.userRole = 'instructor';
          this.isInstructor = true;
          this.isAdmin = false;
          this.currentUserId = null;
          
          // Fallback to default instructor role
          this.userRole = 'instructor';
          this.isInstructor = true;
          this.isAdmin = false;
          this.currentUserId = null;
        }
      } else {
        // Fallback values
        this.userRole = 'instructor';
        this.isInstructor = true;
        this.isAdmin = false;
        this.currentUserId = null;
      }
    }
  }

  async loadParticipantStatistics() {
    this.loading = true;
    this.error = null;
    this.dataSource = 'Đang kết nối API...';

    try {
      
      // Debug authentication state
      // Check user authentication
      if (typeof localStorage !== 'undefined') {
        const token = localStorage.getItem('token');
        if (!token || !this.sessionService.isTokenValid(token)) {
          throw new Error('Authentication token is invalid or expired. Please login again.');
        }
      }

      // Validate required user data
      if (!this.currentUserId) {
        throw new Error('User ID is required but not available. Please login again.');
      }
      
      // Load data based on user role - instructor has limited access
      let coursesData, enrollmentsData, myCoursesData, enrollmentStats;
      
      if (this.isInstructor && !this.isAdmin) {
        // Instructor: Only load courses they teach
        try {
          // First get all courses, then filter by instructor ID
          const allCourses = await this.courseService.getCourses().toPromise();
          
          coursesData = allCourses?.filter(course => {
            const isMatch = course.instructorId === this.currentUserId;
            return isMatch;
          }) || [];
          
          
          // Get enrollment stats for each course
          if (coursesData.length > 0) {
            const coursesWithStats = [];
            for (const course of coursesData) {
              try {
                
                // KIỂM TRA THÊM: Gọi API để xem course details từ backend
                try {
                  const courseDetails = await this.courseService.getCourseById(course.courseId).toPromise();
                  
                  if (courseDetails?.instructorId !== this.currentUserId) {
                    // Instructor ID mismatch detected
                  }
                } catch (courseError) {
                  // Could not get course details from backend
                }
                
                const enrollments = await this.courseService.getEnrollmentsByCourse(course.courseId).toPromise();
                coursesWithStats.push({
                  ...course,
                  enrollments: enrollments || [],
                  enrollmentCount: enrollments ? enrollments.length : 0
                });
              } catch (error: any) {
                
                if (error?.status === 403) {
                  // Log JWT token details for debugging
                  const token = localStorage.getItem('token');
                  if (token) {
                    try {
                      const payload = JSON.parse(atob(token.split('.')[1]));
                      // JWT payload logged for debugging
                    } catch (parseError) {
                      // Could not parse token
                    }
                  }
                }
                
                coursesWithStats.push({
                  ...course,
                  enrollments: [],
                  enrollmentCount: 0
                });
              }
            }
            coursesData = coursesWithStats;
          }
          
          // Instructor không cần các API admin khác
          enrollmentsData = [];
          myCoursesData = null;
          enrollmentStats = null;
          
        } catch (error) {
          coursesData = [];
          enrollmentsData = [];
          myCoursesData = null;
          enrollmentStats = null;
        }
      } else if (this.isAdmin) {
        // Admin: Load all data
        try {
          const promises = [
            this.courseService.getCourses().toPromise(),
            this.courseService.getAllEnrollments().toPromise().catch(() => []),
            this.courseService.getMyCourses().toPromise().catch(() => null),
            this.courseService.getEnrollmentStatistics().toPromise().catch(() => null)
          ];
          [coursesData, enrollmentsData, myCoursesData, enrollmentStats] = await Promise.all(promises);
        } catch (error) {
          coursesData = [];
          enrollmentsData = [];
          myCoursesData = null;
          enrollmentStats = null;
        }
      } else {
        coursesData = [];
        enrollmentsData = [];
        myCoursesData = null;
        enrollmentStats = null;
      }

      // Initialize final enrollments array
      let finalEnrollments: EnrollmentData[] = [];

      // Set courses data based on role
      if (coursesData && coursesData.length > 0) {
        this.courses = coursesData;
        this.dataSource = 'Dữ liệu thực từ API';
        this.isUsingRealData = true;
      } else {
        this.courses = [];
        this.dataSource = 'API kết nối nhưng không có dữ liệu khóa học';
        this.isUsingRealData = false;
      }

      // Process enrollments data based on role
      if (this.isInstructor) {
        // Instructor: Extract enrollments from course data only
        const instructorEnrollments: EnrollmentData[] = [];
        if (coursesData && coursesData.length > 0) {
          coursesData.forEach((course: any) => {
            if (course.enrollments && course.enrollments.length > 0) {
              course.enrollments.forEach((enrollment: any, index: number) => {
                // API trả về UserDTO, chúng ta xử lý thành enrollment format
                const enrollmentData = {
                  enrollmentId: enrollment.enrollmentId || `${course.courseId}_${enrollment.userId}_${index}`,
                  userId: enrollment.userId || enrollment.id || 0,
                  courseId: course.courseId,
                  courseTitle: course.title,
                  enrolledAt: enrollment.enrolledAt || enrollment.createdAt || new Date().toISOString(),
                  status: enrollment.status || 'active',
                  // Thông tin bổ sung từ UserDTO
                  username: enrollment.username,
                  email: enrollment.email,
                  fullName: enrollment.fullName
                };
                instructorEnrollments.push(enrollmentData);
              });
            }
          });
        }
        finalEnrollments = instructorEnrollments;
      } else {
        // Admin: Combine enrollments data from different sources
        if (enrollmentsData && enrollmentsData.length > 0) {
          const standardEnrollments = enrollmentsData.map((enrollment: any, index: number) => ({
            enrollmentId: enrollment.enrollmentId || enrollment.id || (index + 1),
            userId: enrollment.userId || 0,
            courseId: enrollment.courseId || 0,
            courseTitle: this.getCourseTitle(enrollment.courseId || 0),
            enrolledAt: enrollment.enrolledAt || enrollment.createdAt || new Date().toISOString(),
            status: enrollment.status || 'active'
          }));
          finalEnrollments = [...finalEnrollments, ...standardEnrollments];
        }

        // Process my courses data (EnrollmentsDTO) for admin if available
        if (myCoursesData && myCoursesData.length > 0) {
          const myCoursesEnrollments = myCoursesData.map((enrollmentDTO: EnrollmentsDTO) => ({
            enrollmentId: enrollmentDTO.enrollmentId,
            userId: enrollmentDTO.userId,
            courseId: enrollmentDTO.courseId,
            courseTitle: enrollmentDTO.courseTitle || enrollmentDTO.courseName || `Khóa học ${enrollmentDTO.courseId}`,
            enrolledAt: enrollmentDTO.enrolledAt || new Date().toISOString(),
            status: enrollmentDTO.status || 'active'
          }));
          
          // Merge with existing enrollments (avoid duplicates)
          myCoursesEnrollments.forEach((newEnrollment: any) => {
            const exists = finalEnrollments.find((existing: any) => 
              existing.enrollmentId === newEnrollment.enrollmentId ||
              (existing.userId === newEnrollment.userId && existing.courseId === newEnrollment.courseId)
            );
            if (!exists) {
              finalEnrollments.push(newEnrollment);
            }
          });
        }
      }

      if (finalEnrollments.length > 0) {
        this.enrollments = finalEnrollments;
        this.isUsingRealData = true;
        this.dataSource = this.isInstructor 
          ? `Dữ liệu từ khóa học của tôi (${finalEnrollments.length} đăng ký)`
          : `Dữ liệu thực từ API (${finalEnrollments.length} đăng ký)`;
      } else {
        this.enrollments = [];
        this.isUsingRealData = this.courses.length > 0; // True if we have courses data
        this.dataSource = this.courses.length > 0 
          ? (this.isInstructor ? 'Khóa học của tôi (chưa có học viên)' : 'Chỉ có dữ liệu khóa học từ API')
          : 'API kết nối nhưng không có dữ liệu';
      }

      // Generate statistics from the real data
      this.generateStatistics();
      this.generateChartData();
      this.setupAllEnrollments();

    } catch (error) {      
      
      // Determine error type for better user feedback
      let errorMessage = 'Không thể kết nối với API. ';
      if (error instanceof Error) {
        if (error.message.includes('ECONNREFUSED') || error.message.includes('ERR_CONNECTION_REFUSED')) {
          errorMessage += 'Server API không hoạt động. Vui lòng kiểm tra server backend (http://localhost:8080).';
          this.dataSource = 'Lỗi: Server API không hoạt động';
        } else if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
          errorMessage += 'Kết nối quá chậm. Vui lòng thử lại.';
          this.dataSource = 'Lỗi: Kết nối timeout';
        } else if (error.message.includes('404')) {
          errorMessage += 'API endpoint không tồn tại. Vui lòng kiểm tra cấu hình.';
          this.dataSource = 'Lỗi: API endpoint không tìm thấy';
        } else if (error.message.includes('401') || error.message.includes('403')) {
          errorMessage += 'Không có quyền truy cập. Vui lòng đăng nhập lại.';
          this.dataSource = 'Lỗi: Không có quyền truy cập';
        } else {
          errorMessage += `Chi tiết lỗi: ${error.message}`;
          this.dataSource = 'Lỗi kết nối API';
        }
      } else {
        errorMessage += 'Lỗi không xác định. Vui lòng thử lại sau.';
        this.dataSource = 'Lỗi không xác định';
      }
      
      this.error = errorMessage;
      this.courses = [];
      this.enrollments = [];
      this.isUsingRealData = false;
      
      // Generate empty statistics
      this.generateStatistics();
      this.generateChartData();
      this.setupAllEnrollments();
    } finally {
      this.loading = false;
    }
  }

  private getCourseTitle(courseId: number): string {
    const course = this.courses.find(c => c.courseId === courseId);
    return course ? course.title : `Khóa học ${courseId}`;
  }

  private generateStatistics() {
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    // Calculate time-based enrollments
    let todayCount = 0;
    let weekCount = 0;
    let monthCount = 0;
    let yearCount = 0;

    this.enrollments.forEach(enrollment => {
      const enrollDate = new Date(enrollment.enrolledAt);
      
      if (enrollDate >= today) todayCount++;
      if (enrollDate >= weekStart) weekCount++;
      if (enrollDate >= monthStart) monthCount++;
      if (enrollDate >= yearStart) yearCount++;
    });

    // Calculate course enrollment counts
    const courseEnrollmentMap = new Map<number, number>();
    this.enrollments.forEach(enrollment => {
      const courseId = enrollment.courseId;
      courseEnrollmentMap.set(courseId, (courseEnrollmentMap.get(courseId) || 0) + 1);
    });

    // Calculate category enrollment counts
    const categoryEnrollmentMap = new Map<number, number>();
    this.enrollments.forEach(enrollment => {
      const course = this.courses.find(c => c.courseId === enrollment.courseId);
      if (course) {
        const categoryId = course.categoryId;
        categoryEnrollmentMap.set(categoryId, (categoryEnrollmentMap.get(categoryId) || 0) + 1);
      }
    });

    // Calculate average per course based on role
    let uniqueCourses: number;
    let averagePerCourse: number;
    
    if (this.isInstructor && !this.isAdmin) {
      // Instructor: Calculate average based on their courses only
      const instructorCourses = this.courses.filter(course => 
        course.instructorId === this.currentUserId
      );
      uniqueCourses = instructorCourses.length;
      averagePerCourse = uniqueCourses > 0 ? this.enrollments.length / uniqueCourses : 0;
    } else {
      // Admin: Calculate average based on all courses with enrollments
      uniqueCourses = new Set(this.enrollments.map(e => e.courseId)).size;
      averagePerCourse = uniqueCourses > 0 ? this.enrollments.length / uniqueCourses : 0;
    }

    // Generate top courses
    const topCourses: TopCourseData[] = Array.from(courseEnrollmentMap.entries())
      .map(([courseId, count]) => {
        const course = this.courses.find(c => c.courseId === courseId);
        return {
          courseId,
          title: course?.title || `Khóa học ${courseId}`,
          enrollmentCount: count,
          categoryId: course?.categoryId || 1
        };
      })
      .sort((a, b) => b.enrollmentCount - a.enrollmentCount)
      .slice(0, 10);

    // Update statistics
    this.statistics = {
      totalParticipants: this.enrollments.length,
      todayEnrollments: todayCount,
      thisWeekEnrollments: weekCount,
      thisMonthEnrollments: monthCount,
      thisYearEnrollments: yearCount,
      averagePerCourse: Math.round(averagePerCourse * 100) / 100,
      enrollmentsByMonth: this.generateMonthlyEnrollments(),
      enrollmentsByCourse: Array.from(courseEnrollmentMap.entries()).map(([courseId, count]) => ({
        label: this.courses.find(c => c.courseId === courseId)?.title || `Khóa học ${courseId}`,
        value: count
      })).slice(0, 10),
      enrollmentsByCategory: Array.from(categoryEnrollmentMap.entries()).map(([categoryId, count]) => ({
        label: `Danh mục ${categoryId}`,
        value: count
      })),
      topCourses,
      recentEnrollments: this.enrollments.slice(0, 10)
    };
    
    // Generate instructor-specific statistics if needed
    if (this.isInstructor && !this.isAdmin) {
      this.generateInstructorStats();
    }
  }

  private generateInstructorStats() {
    
    // Get instructor's courses
    const instructorCourses = this.courses.filter(course => 
      course.instructorId === this.currentUserId
    );
    
    // Calculate enrollment counts per course
    const courseEnrollmentCounts = instructorCourses.map(course => {
      const enrollmentCount = this.enrollments.filter(enrollment => 
        enrollment.courseId === course.courseId
      ).length;
      return {
        course,
        enrollmentCount
      };
    });
    
    // Calculate statistics
    const coursesWithStudents = courseEnrollmentCounts.filter(item => item.enrollmentCount > 0).length;
    const coursesWithoutStudents = instructorCourses.length - coursesWithStudents;
    const enrollmentCounts = courseEnrollmentCounts.map(item => item.enrollmentCount);
    const maxStudents = enrollmentCounts.length > 0 ? Math.max(...enrollmentCounts) : 0;
    const minStudents = enrollmentCounts.length > 0 ? Math.min(...enrollmentCounts) : 0;
    
    // Find most and least popular courses
    const sortedCourses = courseEnrollmentCounts.sort((a, b) => b.enrollmentCount - a.enrollmentCount);
    const mostPopular = sortedCourses[0];
    const leastPopular = sortedCourses[sortedCourses.length - 1];
    
    this.instructorStats = {
      totalMyCourses: instructorCourses.length,
      coursesWithStudents: coursesWithStudents,
      coursesWithoutStudents: coursesWithoutStudents,
      averageStudentsPerCourse: Math.round(this.statistics.averagePerCourse * 100) / 100,
      maxStudentsInCourse: maxStudents,
      minStudentsInCourse: minStudents,
      mostPopularCourse: mostPopular?.course.title || 'Chưa có',
      leastPopularCourse: leastPopular?.course.title || 'Chưa có'
    };
  }

  private generateMonthlyEnrollments(): ChartData[] {
    const currentYear = new Date().getFullYear();
    const months = [
      'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
      'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
    ];
    
    return months.map((month, index) => {
      const monthStart = new Date(currentYear, index, 1);
      const monthEnd = new Date(currentYear, index + 1, 0);
      
      const count = this.enrollments.filter(enrollment => {
        const enrollDate = new Date(enrollment.enrolledAt);
        return enrollDate >= monthStart && enrollDate <= monthEnd;
      }).length;
      
      return {
        label: month,
        value: count
      };
    });
  }

  private generateChartData() {
    this.monthlyEnrollments = this.statistics.enrollmentsByMonth;
    this.courseEnrollments = this.statistics.enrollmentsByCourse;
    this.categoryEnrollments = this.statistics.enrollmentsByCategory;
  }

  private setupAllEnrollments() {
    this.totalEnrollments = this.enrollments.length;
    this.filteredEnrollments = [...this.enrollments];
    this.sortEnrollments();
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

  applyFilters() {
    let filtered = [...this.enrollments];

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

      filtered = filtered.filter(enrollment => {
        const enrollDate = new Date(enrollment.enrolledAt);
        return enrollDate >= startDate;
      });
    }

    // Apply search filter
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(enrollment => 
        enrollment.courseTitle.toLowerCase().includes(term) ||
        enrollment.enrollmentId.toString().includes(term) ||
        enrollment.userId.toString().includes(term)
      );
    }

    // Apply course filter
    if (this.selectedCourse) {
      filtered = filtered.filter(enrollment => 
        enrollment.courseId.toString() === this.selectedCourse
      );
    }

    // Apply category filter
    if (this.selectedCategory) {
      filtered = filtered.filter(enrollment => {
        const course = this.courses.find(c => c.courseId === enrollment.courseId);
        return course && course.categoryId.toString() === this.selectedCategory;
      });
    }

    this.filteredEnrollments = filtered;
    this.totalEnrollments = filtered.length;
    this.currentPage = 1;
    this.sortEnrollments();
    this.updatePagination();
  }

  // Sorting
  sortBy(field: string) {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'desc';
    }
    this.sortEnrollments();
    this.updatePagination();
  }

  private sortEnrollments() {
    this.filteredEnrollments.sort((a, b) => {
      let valueA: any;
      let valueB: any;

      switch (this.sortField) {
        case 'enrolledAt':
          valueA = new Date(a.enrolledAt).getTime();
          valueB = new Date(b.enrolledAt).getTime();
          break;
        case 'enrollmentId':
          valueA = a.enrollmentId;
          valueB = b.enrollmentId;
          break;
        case 'courseTitle':
          valueA = a.courseTitle.toLowerCase();
          valueB = b.courseTitle.toLowerCase();
          break;
        case 'userId':
          valueA = a.userId;
          valueB = b.userId;
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
    this.totalPages = Math.ceil(this.totalEnrollments / this.itemsPerPage);
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedEnrollments = this.filteredEnrollments.slice(startIndex, endIndex);
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
    return Math.min(this.currentPage * this.itemsPerPage, this.totalEnrollments);
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
    this.selectedCourse = '';
    this.selectedCategory = '';
    this.selectedTimeFilter = '';
    this.applyFilters();
  }

  getMaxValue(data: ChartData[]): number {
    return Math.max(...data.map(item => item.value));
  }

  getBarHeight(value: number, maxValue: number): number {
    return maxValue > 0 ? (value / maxValue) * 100 : 0;
  }

  getFormattedDate(dateString: string): string {
    try {
      const date = new Date(dateString);
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

  // Safe value getters to avoid template errors
  safeGetValue(value: any, defaultValue: any = 'N/A'): any {
    return value !== undefined && value !== null ? value : defaultValue;
  }

  safeFormatNumber(value: number, decimals: number = 0): string {
    if (value === undefined || value === null || isNaN(value)) {
      return '0';
    }
    return value.toFixed(decimals);
  }

  safeGetArrayLength(array: any[]): number {
    return array && Array.isArray(array) ? array.length : 0;
  }

  // Track by function for ngFor performance
  trackByEnrollmentId(index: number, enrollment: EnrollmentData): number | string {
    return enrollment.enrollmentId;
  }

  // Course filter methods
  filterByCourse(courseId: number, courseTitle: string) {
    this.selectedCourse = courseId.toString();
    this.applyFilters();
  }

  getCourseNameById(courseId: string): string {
    if (!courseId) return '';
    const course = this.courses.find(c => c.courseId.toString() === courseId);
    return course ? course.title : `Khóa học ${courseId}`;
  }

  // Course participants modal methods
  async showCourseParticipants(course: TopCourseData) {
    
    this.selectedCourseForParticipants = this.courses.find(c => c.courseId === course.courseId) || null;
    this.showParticipantsModal = true;
    this.loadingParticipants = true;
    this.participantsError = null;
    this.courseParticipants = [];

    try {
      // Filter enrollments for this course
      const courseEnrollments = this.enrollments.filter(enrollment => 
        enrollment.courseId === course.courseId
      );

      if (courseEnrollments.length === 0 && this.isInstructor) {
        // If no enrollments found locally, try to fetch from API
        const freshEnrollments = await this.courseService.getEnrollmentsByCourse(course.courseId).toPromise();
        
        if (freshEnrollments && freshEnrollments.length > 0) {
          // Convert API response to our enrollment format
          const convertedEnrollments = freshEnrollments.map((enrollment: any, index: number) => ({
            enrollmentId: enrollment.enrollmentId || `${course.courseId}_${enrollment.userId || enrollment.id}_${index}`,
            userId: enrollment.userId || enrollment.id || 0,
            courseId: course.courseId,
            courseTitle: course.title,
            enrolledAt: enrollment.enrolledAt || enrollment.createdAt || new Date().toISOString(),
            status: enrollment.status || 'active',
            // User details from API
            username: enrollment.username,
            email: enrollment.email,
            fullName: enrollment.fullName
          }));
          
          this.courseParticipants = convertedEnrollments;
        } else {
          this.courseParticipants = [];
        }
      } else {
        this.courseParticipants = courseEnrollments;
      }

      // Sort by enrollment date (newest first)
      this.courseParticipants.sort((a, b) => 
        new Date(b.enrolledAt).getTime() - new Date(a.enrolledAt).getTime()
      );

    } catch (error) {
      this.participantsError = 'Không thể tải danh sách người tham gia. Vui lòng thử lại.';
      this.courseParticipants = [];
    } finally {
      this.loadingParticipants = false;
    }
  }

  async reloadCourseParticipants() {
    if (this.selectedCourseForParticipants) {
      // Convert Course to TopCourseData for reload
      const topCourseData: TopCourseData = {
        courseId: this.selectedCourseForParticipants.courseId,
        title: this.selectedCourseForParticipants.title,
        categoryId: this.selectedCourseForParticipants.categoryId,
        enrollmentCount: this.courseParticipants.length
      };
      await this.showCourseParticipants(topCourseData);
    }
  }

  closeCourseParticipantsModal() {
    this.showParticipantsModal = false;
    this.selectedCourseForParticipants = null;
    this.courseParticipants = [];
    this.participantsError = null;
  }

  // Course statistics modal methods
  showCourseStatistics(statType: string, statTitle: string) {
    
    this.selectedStatType = statType;
    this.selectedStatTitle = statTitle;
    this.showCourseStatsModal = true;
    this.loadingCourseStats = true;
    this.courseStatsError = null;
    this.courseStatsList = [];

    try {
      // Get instructor's courses
      const instructorCourses = this.courses.filter(course => 
        course.instructorId === this.currentUserId
      );

      // Calculate enrollment counts for each course
      const coursesWithStats = instructorCourses.map(course => {
        const enrollmentCount = this.enrollments.filter(enrollment => 
          enrollment.courseId === course.courseId
        ).length;
        return {
          ...course,
          enrollmentCount
        };
      });

      // Filter courses based on statType
      let filteredCourses: Course[] = [];
      
      switch (statType) {
        case 'total':
          filteredCourses = instructorCourses;
          break;
        case 'withStudents':
          filteredCourses = coursesWithStats.filter(course => course.enrollmentCount > 0);
          break;
        case 'withoutStudents':
          filteredCourses = coursesWithStats.filter(course => course.enrollmentCount === 0);
          break;
        case 'maxStudents':
          const maxCount = Math.max(...coursesWithStats.map(c => c.enrollmentCount));
          filteredCourses = coursesWithStats.filter(course => course.enrollmentCount === maxCount);
          break;
        case 'minStudents':
          const minCount = Math.min(...coursesWithStats.map(c => c.enrollmentCount));
          filteredCourses = coursesWithStats.filter(course => course.enrollmentCount === minCount);
          break;
        default:
          filteredCourses = instructorCourses;
      }

      // Sort by enrollment count (descending)
      filteredCourses.sort((a, b) => {
        const aCount = (a as any).enrollmentCount || 0;
        const bCount = (b as any).enrollmentCount || 0;
        return bCount - aCount;
      });

      this.courseStatsList = filteredCourses;

    } catch (error) {
      this.courseStatsError = 'Không thể tải danh sách khóa học. Vui lòng thử lại.';
      this.courseStatsList = [];
    } finally {
      this.loadingCourseStats = false;
    }
  }

  closeCourseStatsModal() {
    this.showCourseStatsModal = false;
    this.selectedStatType = '';
    this.selectedStatTitle = '';
    this.courseStatsList = [];
    this.courseStatsError = null;
  }

  // Get enrollment count for a specific course
  getCourseEnrollmentCount(courseId: number): number {
    return this.enrollments.filter(enrollment => 
      enrollment.courseId === courseId
    ).length;
  }

  // Get course image URL
  getCourseImageUrl(course: Course): string {
    if (!course.thumbnailUrl) {
      return 'assets/default-course.png'; // Fallback image
    }
    return `http://localhost:8080/images/courses/${course.thumbnailUrl}`;
  }

  // Handle image loading errors
  onImageError(event: any) {
    event.target.src = 'assets/default-course.png';
  }

  // Data refresh and export
  refreshData() {
    this.loadParticipantStatistics();
  }

  async checkAPIConnection(): Promise<boolean> {
    try {
      // Simple health check
      await this.courseService.getCourses().toPromise();
      return true;
    } catch (error) {
      return false;
    }
  }

  async testAPIConnection() {
    this.loading = true;
    this.dataSource = 'Đang kiểm tra kết nối API...';
    
    try {
      const isConnected = await this.checkAPIConnection();
      if (isConnected) {
        this.error = null;
        this.dataSource = 'API kết nối thành công';
        // Reload data after successful connection test
        this.loadParticipantStatistics();
      } else {
        this.error = 'Không thể kết nối với API Server. Vui lòng kiểm tra server backend.';
        this.dataSource = 'Lỗi: Không thể kết nối API';
      }
    } catch (error) {
      this.error = 'Lỗi kiểm tra kết nối API.';
      this.dataSource = 'Lỗi kiểm tra kết nối';
    } finally {
      this.loading = false;
    }
  }

  debugAPIData() {
    // Debug information logged to browser console for development
  }

  exportStatistics() {
    const data = {
      timestamp: new Date().toISOString(),
      dataSource: this.dataSource,
      isUsingRealData: this.isUsingRealData,
      statistics: this.statistics,
      totalEnrollments: this.totalEnrollments,
      charts: {
        monthly: this.monthlyEnrollments,
        courses: this.courseEnrollments,
        categories: this.categoryEnrollments
      },
      rawData: {
        courses: this.courses,
        enrollments: this.enrollments.slice(0, 10) // First 10 for sample
      },
      debug: {
        coursesCount: this.courses.length,
        enrollmentsCount: this.enrollments.length,
        error: this.error
      }
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `thong-ke-nguoi-tham-gia-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // Profile component event handlers
  onProfileUpdate() {
    // Profile update requested
  }

  onLogout() {
    this.sessionService.logout();
  }

  // Debug API connectivity
  async debugAPIConnectivity() {
    // API Connectivity Debug
    
    // Check authentication first
    if (typeof localStorage !== 'undefined') {
      const token = localStorage.getItem('token');
      if (!token || !this.sessionService.isTokenValid(token)) {
        return;
      }
    }

    try {
      // Testing API endpoints...
      
      // Test each endpoint individually
      const endpoints = [
        { name: 'Courses', test: () => this.courseService.getCourses().toPromise() },
        { name: 'Enrollments', test: () => this.courseService.getAllEnrollments().toPromise() },
        { name: 'My Courses', test: () => this.courseService.getMyCourses().toPromise() },
        { name: 'Enrollment Stats', test: () => this.courseService.getEnrollmentStatistics().toPromise() }
      ];

      for (const endpoint of endpoints) {
        try {
          const result = await endpoint.test();
        } catch (error) {
          // Endpoint error handled
        }
      }
      
    } catch (error) {
      // General error handled
    }
  }

  // Test specific course enrollment access
  async testCourseAccess(courseId: number) {
    // Testing Course Access
    
    try {
      // 1. Get course details
      const courseDetails = await this.courseService.getCourseById(courseId).toPromise();
      
      // 2. Check ownership
      const isOwner = courseDetails?.instructorId === this.currentUserId;
      
      // 3. Try to get enrollments
      const enrollments = await this.courseService.getEnrollmentsByCourse(courseId).toPromise();
      
    } catch (error: any) {
      // Failed to access course
    }
  }

  // Additional debug methods
  debugTableState() {
    // Table Debug State - information available for development debugging
  }

  forceFixCourseTitles() {
    this.enrollments.forEach(enrollment => {
      if (!enrollment.courseTitle || enrollment.courseTitle.includes('Khóa học')) {
        const course = this.courses.find(c => c.courseId === enrollment.courseId);
        if (course) {
          enrollment.courseTitle = course.title;
        }
      }
    });
    this.setupAllEnrollments();
  }
  
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

      // Chụp ảnh nội dung
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });

      // Chụp ảnh biểu đồ từ DOM (nếu có)
      let imgChartMonthly = '';
      let imgChartCourse = '';
      let imgChartCategory = '';
      const chartMonthlyEl = document.querySelector('#chart-monthly') as HTMLElement;
      const chartCourseEl = document.querySelector('#chart-course') as HTMLElement;
      const chartCategoryEl = document.querySelector('#chart-category') as HTMLElement;
      if (chartMonthlyEl) {
        const chartMonthlyCanvas = await html2canvas(chartMonthlyEl, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#fff' });
        imgChartMonthly = chartMonthlyCanvas.toDataURL('image/png');
      }
      if (chartCourseEl) {
        const chartCourseCanvas = await html2canvas(chartCourseEl, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#fff' });
        imgChartCourse = chartCourseCanvas.toDataURL('image/png');
      }
      if (chartCategoryEl) {
        const chartCategoryCanvas = await html2canvas(chartCategoryEl, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#fff' });
        imgChartCategory = chartCategoryCanvas.toDataURL('image/png');
      }

      // Hàm load font base64
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

      // Load font thường và font đậm
      const [fontRegularBase64, fontBoldBase64] = await Promise.all([
        loadFontBase64('/assets/fonts/DejaVuSans.ttf'),
        loadFontBase64('/assets/fonts/DejaVuLGCSans-Bold.ttf')
      ]);

      // Tạo PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      (pdf as any).addFileToVFS('DejaVuSans.ttf', fontRegularBase64);
      (pdf as any).addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal');
      (pdf as any).addFileToVFS('DejaVuLGCSans-Bold.ttf', fontBoldBase64);
      (pdf as any).addFont('DejaVuLGCSans-Bold.ttf', 'DejaVuSans', 'bold');

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
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

pdf.setFontSize(12);
pdf.setFont('DejaVuSans', 'normal');
pdf.text('Độc lập - Tự do - Hạnh phúc', centerX, marginTop + lineHeight, { align: 'center' });

// === Ngày tháng căn phải ===
const today = new Date();
const formattedDate = `Hà Nội, ngày ${today.getDate().toString().padStart(2, '0')} tháng ${(today.getMonth() + 1)
  .toString()
  .padStart(2, '0')} năm ${today.getFullYear()}`;
pdf.text(formattedDate, pageWidth - marginRight, marginTop + lineHeight * 2 + 5, { align: 'right' });

// Sau đó tiếp tục các phần khác (mục I, bảng...) và dùng marginLeft/marginRight để canh lề
let yPos = marginTop + 6 * lineHeight+10;
      // Tiêu đề chính
      pdf.setFontSize(14);
      pdf.setFont('DejaVuSans', 'bold');
      pdf.text('BÁO CÁO THỐNG KÊ NGƯỜI THAM GIA KHÓA HỌC', centerX, topY + 3 * lineHeight + 20, { align: 'center' });

      // Tóm tắt
      let yPos2 = topY + 6 * lineHeight + 40;
      pdf.setFontSize(13);
      pdf.setFont('DejaVuSans', 'bold');
      pdf.text('I. TÓM TẮT THỐNG KÊ', margin, yPos); yPos += lineHeight + 3;

      pdf.setFontSize(11);
      pdf.setFont('DejaVuSans', 'normal');
      pdf.text(`• Đăng ký hôm nay: ${this.statistics.todayEnrollments}`, margin + 5, yPos); yPos += lineHeight;
      pdf.text(`• Đăng ký trong tuần: ${this.statistics.thisWeekEnrollments}`, margin + 5, yPos); yPos += lineHeight;
      pdf.text(`• Đăng ký trong tháng: ${this.statistics.thisMonthEnrollments}`, margin + 5, yPos); yPos += lineHeight;
      pdf.text(`• Đăng ký trong năm: ${this.statistics.thisYearEnrollments}`, margin + 5, yPos); yPos += lineHeight;
      pdf.text(`• Tổng số người tham gia: ${this.statistics.totalParticipants}`, margin + 5, yPos); yPos += lineHeight;
      pdf.text(`• Trung bình mỗi khóa học: ${this.statistics.averagePerCourse}`, margin + 5, yPos); yPos += lineHeight + 5;

      // Bảng danh sách người tham gia
      let tableStartY = yPos + 10;
      pdf.setFontSize(14);
      pdf.setFont('DejaVuSans', 'bold');
      pdf.text('II. DANH SÁCH NGƯỜI THAM GIA', margin, tableStartY);

      const tableData = this.enrollments.map((enr: any) => [
        String(enr.enrollmentId),
        enr.courseTitle || '',
        enr.username || enr.fullName || enr.email || enr.userId,
        this.getFormattedDate(enr.enrolledAt),
        enr.status || ''
      ]);

      autoTable(pdf, {
        head: [['ID', 'Khóa học', 'Người dùng', 'Ngày đăng ký', 'Trạng thái']],
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
          1: { cellWidth: 60 },
          2: { cellWidth: 40 },
          3: { cellWidth: 30, halign: 'center' },
          4: { cellWidth: 25, halign: 'center' },
        },
        margin: { left: marginLeft, right: marginRight } 
      });

      // Trang biểu đồ
      // Footer
      pdf.setFontSize(10);
      pdf.setFont('DejaVuSans', 'italic');
      pdf.text('CMC Learn - Learning Management System', centerX, pdfHeight - 10, { align: 'center' });

      // Lưu file PDF
      const fileName = `bao-cao-thong-ke-nguoi-tham-gia-${today.toISOString().split('T')[0]}.pdf`;
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

}