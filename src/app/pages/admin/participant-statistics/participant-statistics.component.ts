import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SessionService } from '../../../services/session.service';
import { CourseService, Course, Enrollment } from '../../../services/course.service';
import { UserService } from '../../../services/user.service';
import { SidebaradminComponent } from '../../../components/sidebaradmin/sidebaradmin.component';
import { SidebarComponent } from '../../../components/sidebar/sidebar.component';
import { ProfileComponent } from '../../../components/profile/profile.component';

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
    console.log('🔍 Loading user info...');
    
    // Get username from session service
    const sessionUsername = this.sessionService.getUsername();
    console.log('📝 Username from session service:', sessionUsername);
    
    this.username = sessionUsername || 'Admin';
    const avatarUrl = localStorage.getItem('avatarUrl');
    this.avatarUrl = avatarUrl || '';
    
    console.log('� Final username:', this.username);
    console.log('🖼️ Avatar URL:', this.avatarUrl);
    
    // Parse JWT token to get user role and ID
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('token');
      console.log('🔑 Token found:', !!token);
      
      if (token) {
        try {
          console.log('🔓 Parsing JWT token...');
          const payload = JSON.parse(atob(token.split('.')[1]));
          console.log('🔍 JWT Payload:', payload);
          
          // Try to get username from token if session service failed
          if (!sessionUsername && payload) {
            this.username = payload.sub || payload.username || payload.email || 'User';
            console.log('📝 Username from JWT payload:', this.username);
          }
          
          // Robust role detection
          this.userRole = payload.role || payload.roles || payload.authorities || 'instructor';
          this.currentUserId = payload.userId || payload.sub || payload.id;
          
          console.log('📋 Extracted from JWT:', {
            userRole: this.userRole,
            currentUserId: this.currentUserId,
            rawRole: payload.role,
            rawRoles: payload.roles,
            rawAuthorities: payload.authorities,
            rawUserId: payload.userId,
            rawSub: payload.sub,
            rawId: payload.id
          });
          
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
          
          console.log('🔍 Final User Info:', {
            role: this.userRole,
            userId: this.currentUserId,
            isAdmin: this.isAdmin,
            isInstructor: this.isInstructor,
            rawPayload: payload
          });
          
          // Ensure no overlap - instructor should not be admin
          if (this.isInstructor && this.isAdmin) {
            console.warn('⚠️ User has both instructor and admin roles, defaulting to instructor');
            this.isAdmin = false;
          }
          
          // Final validation
          if (!this.currentUserId) {
            console.error('❌ No user ID found in JWT token!');
            throw new Error('User ID not found in token');
          }
          
          if (!this.isAdmin && !this.isInstructor) {
            console.warn('⚠️ No valid role found, defaulting to instructor');
            this.isInstructor = true;
          }
          
        } catch (error) {
          console.error('❌ Error parsing JWT token:', error);
          console.error('🔑 Token details:', {
            tokenLength: token.length,
            tokenStart: token.substring(0, 50) + '...',
            splitParts: token.split('.').length
          });
          
          // Fallback to default instructor role
          this.userRole = 'instructor';
          this.isInstructor = true;
          this.isAdmin = false;
          this.currentUserId = null;
          
          console.log('🚨 Using fallback values:', {
            userRole: this.userRole,
            isInstructor: this.isInstructor,
            isAdmin: this.isAdmin,
            currentUserId: this.currentUserId
          });
        }
      } else {
        console.error('❌ No JWT token found in localStorage');
        // Fallback values
        this.userRole = 'instructor';
        this.isInstructor = true;
        this.isAdmin = false;
        this.currentUserId = null;
      }
    } else {
      console.warn('⚠️ Not running in browser platform');
    }
    
    console.log('✅ User info loading completed:', {
      username: this.username,
      userRole: this.userRole,
      currentUserId: this.currentUserId,
      isAdmin: this.isAdmin,
      isInstructor: this.isInstructor
    });
  }

  async loadParticipantStatistics() {
    this.loading = true;
    this.error = null;
    this.dataSource = 'Đang kết nối API...';

    try {
      console.log('🚀 Starting loadParticipantStatistics...');
      
      // Debug authentication state
      // Check user authentication
      if (typeof localStorage !== 'undefined') {
        const token = localStorage.getItem('token');
        if (!token || !this.sessionService.isTokenValid(token)) {
          throw new Error('Authentication token is invalid or expired. Please login again.');
        }
      }

      console.log('🔄 Loading participant statistics from API...');
      
      // Validate required user data
      if (!this.currentUserId) {
        console.error('❌ No current user ID available!');
        throw new Error('User ID is required but not available. Please login again.');
      }
      
      // Load data based on user role - instructor has limited access
      let coursesData, enrollmentsData, myCoursesData, enrollmentStats;
      
      if (this.isInstructor && !this.isAdmin) {
        console.log('👨‍🏫 Loading instructor-only data - NO ADMIN APIS...');
        // Instructor: Only load courses they teach
        try {
          // First get all courses, then filter by instructor ID
          const allCourses = await this.courseService.getCourses().toPromise();
          console.log('🎓 All courses loaded:', allCourses?.length || 0, 'courses');
          
          coursesData = allCourses?.filter(course => {
            const isMatch = course.instructorId === this.currentUserId;
            return isMatch;
          }) || [];
          
          console.log('✅ Instructor courses loaded:', coursesData.length, 'courses');
          console.log('📝 Instructor courses:', coursesData.map(c => ({ id: c.courseId, title: c.title, instructorId: c.instructorId })));
          
          // Get enrollment stats for each course
          if (coursesData.length > 0) {
            const coursesWithStats = [];
            for (const course of coursesData) {
              try {
                console.log(`🔄 Loading enrollments for course ${course.courseId}...`);
                console.log(`🔑 Current user ID: ${this.currentUserId}`);
                console.log(`📚 Course instructor ID: ${course.instructorId}`);
                console.log(`✅ Ownership check: ${course.instructorId === this.currentUserId}`);
                
                // KIỂM TRA THÊM: Gọi API để xem course details từ backend
                console.log(`🔍 Checking course ${course.courseId} details from backend...`);
                try {
                  const courseDetails = await this.courseService.getCourseById(course.courseId).toPromise();
                  console.log(`📋 Backend course ${course.courseId} details:`, {
                    courseId: courseDetails?.courseId,
                    title: courseDetails?.title,
                    instructorId: courseDetails?.instructorId,
                    status: courseDetails?.status
                  });
                  
                  if (courseDetails?.instructorId !== this.currentUserId) {
                    console.error(`🚨 MISMATCH: Frontend says course ${course.courseId} instructor is ${course.instructorId}, but backend says ${courseDetails?.instructorId}`);
                  }
                } catch (courseError) {
                  console.error(`❌ Could not get course ${course.courseId} details from backend:`, courseError);
                }
                
                // Debug the API call
                console.log(`📡 Making API call to: /api/courses/course/${course.courseId}/enrollments`);
                
                const enrollments = await this.courseService.getEnrollmentsByCourse(course.courseId).toPromise();
                coursesWithStats.push({
                  ...course,
                  enrollments: enrollments || [],
                  enrollmentCount: enrollments ? enrollments.length : 0
                });
                console.log(`✅ Course ${course.courseId} enrollments:`, enrollments?.length || 0);
              } catch (error: any) {
                console.error(`❌ Failed to load enrollments for course ${course.courseId}:`, error);
                console.error(`🔍 Error details:`, {
                  status: error?.status,
                  message: error?.message,
                  url: error?.url
                });
                
                if (error?.status === 403) {
                  console.error(`🚫 403 Forbidden for course ${course.courseId}:`);
                  console.error(`   - Current user ID: ${this.currentUserId}`);
                  console.error(`   - Course instructor ID: ${course.instructorId}`);
                  console.error(`   - User role: ${this.userRole}`);
                  console.error(`   - Is instructor: ${this.isInstructor}`);
                  
                  // Log JWT token details for debugging
                  const token = localStorage.getItem('token');
                  if (token) {
                    try {
                      const payload = JSON.parse(atob(token.split('.')[1]));
                      console.error(`🔍 JWT payload for debugging:`, {
                        userId: payload.userId,
                        sub: payload.sub,
                        id: payload.id,
                        role: payload.role,
                        roles: payload.roles,
                        authorities: payload.authorities,
                        exp: payload.exp,
                        iat: payload.iat
                      });
                    } catch (parseError) {
                      console.error(`❌ Could not parse token:`, parseError);
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
          } else {
            console.warn('⚠️ No courses found for instructor ID:', this.currentUserId);
          }
          
          // Instructor không cần các API admin khác
          enrollmentsData = [];
          myCoursesData = null;
          enrollmentStats = null;
          
          console.log('✅ Instructor data loaded successfully');
        } catch (error) {
          console.error('❌ Failed to load instructor courses:', error);
          coursesData = [];
          enrollmentsData = [];
          myCoursesData = null;
          enrollmentStats = null;
        }
      } else if (this.isAdmin) {
        console.log('👑 Loading admin data...');
        // Admin: Load all data
        try {
          const promises = [
            this.courseService.getCourses().toPromise(),
            this.courseService.getAllEnrollments().toPromise().catch(() => []),
            this.courseService.getMyCourses().toPromise().catch(() => null),
            this.courseService.getEnrollmentStatistics().toPromise().catch(() => null)
          ];
          [coursesData, enrollmentsData, myCoursesData, enrollmentStats] = await Promise.all(promises);
          console.log('✅ Admin data loaded successfully');
        } catch (error) {
          console.error('❌ Failed to load admin data:', error);
          coursesData = [];
          enrollmentsData = [];
          myCoursesData = null;
          enrollmentStats = null;
        }
      } else {
        console.warn('⚠️ Unknown user role, defaulting to empty data');
        coursesData = [];
        enrollmentsData = [];
        myCoursesData = null;
        enrollmentStats = null;
      }

      console.log('✅ API Response - Courses:', coursesData);
      console.log('✅ API Response - Enrollments:', enrollmentsData);
      console.log('✅ API Response - My Courses:', myCoursesData);
      console.log('✅ API Response - Enrollment Stats:', enrollmentStats);

      // Initialize final enrollments array
      let finalEnrollments: EnrollmentData[] = [];

      // Set courses data based on role
      if (coursesData && coursesData.length > 0) {
        this.courses = coursesData;
        this.dataSource = 'Dữ liệu thực từ API';
        this.isUsingRealData = true;
        
        if (this.isInstructor) {
          console.log(`👨‍🏫 Instructor courses with stats loaded: ${this.courses.length} courses`);
        } else {
          console.log(`👑 Admin viewing all courses: ${this.courses.length} courses`);
        }
      } else {
        this.courses = [];
        this.dataSource = 'API kết nối nhưng không có dữ liệu khóa học';
        this.isUsingRealData = false;
        console.log('⚠️ No courses data available');
      }

      // Process enrollments data based on role
      if (this.isInstructor) {
        // Instructor: Extract enrollments from course data only
        const instructorEnrollments: EnrollmentData[] = [];
        if (coursesData && coursesData.length > 0) {
          coursesData.forEach((course: any) => {
            console.log(`📊 Processing course ${course.courseId} enrollments:`, course.enrollments);
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
                console.log(`✅ Added enrollment:`, enrollmentData);
              });
            } else {
              console.log(`⚠️ No enrollments found for course ${course.courseId}`);
            }
          });
        }
        finalEnrollments = instructorEnrollments;
        console.log('👨‍🏫 Instructor enrollments processed:', finalEnrollments.length);
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
          console.log('✅ Added standard enrollments:', standardEnrollments.length);
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
          console.log('✅ Added my courses enrollments:', myCoursesEnrollments.length);
        }
        console.log('👑 Admin enrollments processed:', finalEnrollments.length);
      }

      if (finalEnrollments.length > 0) {
        this.enrollments = finalEnrollments;
        this.isUsingRealData = true;
        this.dataSource = this.isInstructor 
          ? `Dữ liệu từ khóa học của tôi (${finalEnrollments.length} đăng ký)`
          : `Dữ liệu thực từ API (${finalEnrollments.length} đăng ký)`;
        console.log('✅ Using combined enrollments data:', this.enrollments.length, 'enrollments');
      } else {
        this.enrollments = [];
        this.isUsingRealData = this.courses.length > 0; // True if we have courses data
        this.dataSource = this.courses.length > 0 
          ? (this.isInstructor ? 'Khóa học của tôi (chưa có học viên)' : 'Chỉ có dữ liệu khóa học từ API')
          : 'API kết nối nhưng không có dữ liệu';
        console.log('⚠️ No enrollments data available');
      }

      // Generate statistics from the real data
      this.generateStatistics();
      this.generateChartData();
      this.setupAllEnrollments();

      console.log('✅ Participant statistics loaded successfully from real API data');

    } catch (error) {
      console.error('❌ Error loading participant statistics from API:', error);
      
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
    console.log('📊 Generating participant statistics...');
    
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
      
      console.log('📊 Instructor average calculation:', {
        instructorCourses: instructorCourses.length,
        totalEnrollments: this.enrollments.length,
        averagePerCourse: averagePerCourse
      });
    } else {
      // Admin: Calculate average based on all courses with enrollments
      uniqueCourses = new Set(this.enrollments.map(e => e.courseId)).size;
      averagePerCourse = uniqueCourses > 0 ? this.enrollments.length / uniqueCourses : 0;
      
      console.log('📊 Admin average calculation:', {
        coursesWithEnrollments: uniqueCourses,
        totalEnrollments: this.enrollments.length,
        averagePerCourse: averagePerCourse
      });
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

    console.log('📊 Generated statistics:', this.statistics);
    
    // Generate instructor-specific statistics if needed
    if (this.isInstructor && !this.isAdmin) {
      this.generateInstructorStats();
    }
  }

  private generateInstructorStats() {
    console.log('👨‍🏫 Generating instructor-specific statistics...');
    
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
    
    console.log('👨‍🏫 Instructor statistics:', this.instructorStats);
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
    console.log('📋 Showing participants for course:', course);
    
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
        console.log(`🔄 Fetching fresh enrollments for course ${course.courseId}...`);
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
          console.log(`✅ Fresh enrollments loaded: ${convertedEnrollments.length}`);
        } else {
          this.courseParticipants = [];
          console.log('⚠️ No enrollments found for this course');
        }
      } else {
        this.courseParticipants = courseEnrollments;
        console.log(`✅ Found ${courseEnrollments.length} participants for course ${course.courseId}`);
      }

      // Sort by enrollment date (newest first)
      this.courseParticipants.sort((a, b) => 
        new Date(b.enrolledAt).getTime() - new Date(a.enrolledAt).getTime()
      );

    } catch (error) {
      console.error('❌ Error loading course participants:', error);
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
    console.log(`📊 Showing course statistics for: ${statType}`);
    
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
      console.log(`✅ Found ${filteredCourses.length} courses for ${statType}`);

    } catch (error) {
      console.error('❌ Error loading course statistics:', error);
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
    console.log('🔄 Refreshing participant statistics data...');
    this.loadParticipantStatistics();
  }

  async checkAPIConnection(): Promise<boolean> {
    try {
      // Simple health check
      await this.courseService.getCourses().toPromise();
      return true;
    } catch (error) {
      console.log('❌ API connection failed:', error);
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
    console.log('🔍 Debug API Data:');
    console.log('📊 Current Statistics:', this.statistics);
    console.log('🎓 Courses:', this.courses);
    console.log('📝 Enrollments:', this.enrollments);
    console.log('📈 Chart Data:', {
      monthly: this.monthlyEnrollments,
      courses: this.courseEnrollments,
      categories: this.categoryEnrollments
    });
    console.log('🔗 Data Source:', this.dataSource);
    console.log('✅ Using Real Data:', this.isUsingRealData);
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
    console.log('Profile update requested');
  }

  onLogout() {
    this.sessionService.logout();
  }

  // Debug API connectivity
  async debugAPIConnectivity() {
    console.group('🔧 API Connectivity Debug');
    
    // Check authentication first
    if (typeof localStorage !== 'undefined') {
      const token = localStorage.getItem('token');
      if (!token || !this.sessionService.isTokenValid(token)) {
        console.log('❌ Cannot test API - invalid token');
        console.groupEnd();
        return;
      }
    }

    try {
      console.log('🔄 Testing API endpoints...');
      
      // Test each endpoint individually
      const endpoints = [
        { name: 'Courses', test: () => this.courseService.getCourses().toPromise() },
        { name: 'Enrollments', test: () => this.courseService.getAllEnrollments().toPromise() },
        { name: 'My Courses', test: () => this.courseService.getMyCourses().toPromise() },
        { name: 'Enrollment Stats', test: () => this.courseService.getEnrollmentStatistics().toPromise() }
      ];

      for (const endpoint of endpoints) {
        try {
          console.log(`Testing ${endpoint.name}...`);
          const result = await endpoint.test();
          console.log(`✅ ${endpoint.name}:`, result);
        } catch (error) {
          console.log(`❌ ${endpoint.name}:`, error);
        }
      }
      
    } catch (error) {
      console.log('❌ General error:', error);
    }
    
    console.groupEnd();
  }

  // Test specific course enrollment access
  async testCourseAccess(courseId: number) {
    console.group(`🔧 Testing Course ${courseId} Access`);
    
    try {
      // 1. Get course details
      console.log(`📋 Getting course ${courseId} details...`);
      const courseDetails = await this.courseService.getCourseById(courseId).toPromise();
      console.log(`Course details:`, courseDetails);
      
      // 2. Check ownership
      const isOwner = courseDetails?.instructorId === this.currentUserId;
      console.log(`Ownership check: ${isOwner} (course.instructorId=${courseDetails?.instructorId}, currentUserId=${this.currentUserId})`);
      
      // 3. Try to get enrollments
      console.log(`📊 Trying to get enrollments for course ${courseId}...`);
      const enrollments = await this.courseService.getEnrollmentsByCourse(courseId).toPromise();
      console.log(`✅ Success! Enrollments:`, enrollments);
      
    } catch (error: any) {
      console.error(`❌ Failed to access course ${courseId}:`, error);
      console.error(`Status: ${error.status}, Message: ${error.message}`);
    }
    
    console.groupEnd();
  }

  // Additional debug methods
  debugTableState() {
    console.log('📋 Table Debug State:');
    console.log('Total enrollments:', this.totalEnrollments);
    console.log('Filtered enrollments:', this.filteredEnrollments.length);
    console.log('Paginated enrollments:', this.paginatedEnrollments.length);
    console.log('Current page:', this.currentPage);
    console.log('Items per page:', this.itemsPerPage);
    console.log('Total pages:', this.totalPages);
    console.log('Filters:', {
      search: this.searchTerm,
      course: this.selectedCourse,
      category: this.selectedCategory,
      time: this.selectedTimeFilter
    });
  }

  forceFixCourseTitles() {
    console.log('🔧 Force fixing course titles...');
    this.enrollments.forEach(enrollment => {
      if (!enrollment.courseTitle || enrollment.courseTitle.includes('Khóa học')) {
        const course = this.courses.find(c => c.courseId === enrollment.courseId);
        if (course) {
          enrollment.courseTitle = course.title;
        }
      }
    });
    this.setupAllEnrollments();
    console.log('✅ Course titles fixed');
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
