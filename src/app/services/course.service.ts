import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, of, forkJoin } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

export interface Course {
  courseId: number; // ✅ Đổi từ 'id' thành 'courseId' để khớp với backend
  title: string;
  description: string;
  categoryId: number;
  instructorId: number;
  status: string;
  price: number;
  thumbnailUrl: string;
  instructorImage?: string; // Optional vì có thể không có
  createdAt?: string; // ✅ Thêm để tính thống kê
  creationDate?: string; // ✅ Thêm để tính thống kê
  updatedAt?: string; // ✅ Thêm để theo dõi cập nhật
}

export interface Enrollment {
  enrollmentId?: number;
  id?: number; // Alternative field name from API
  userId: number;
  courseId: number;
  courseTitle?: string;
  enrolledAt?: string;
  createdAt?: string; // Alternative field name from API
  status: string;
  completedAt?: string;
  progress?: number;
}

@Injectable({
  providedIn: 'root'
})
export class CourseService {
  private baseUrl = 'http://localhost:8080/api/courses';

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  getCourses(categoryId?: number, status?: string): Observable<Course[]> {
    let params = new HttpParams();
    if (categoryId != null) params = params.set('categoryId', categoryId.toString());
    if (status) params = params.set('status', status);

    // Add token for authentication (SSR-safe)
    let headers = new HttpHeaders();
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('token');
      if (token) {
        headers = headers.set('Authorization', `Bearer ${token}`);
      }
    }

    return this.http.get<Course[]>(`${this.baseUrl}/list`, { params, headers });
  }

  createCourse(
    course: Omit<Course, 'courseId' | 'thumbnailUrl' | 'instructorImage'>,
    imageFile: File
  ): Observable<any> {
    const formData = this.buildFormData(course, imageFile);
    return this.http.post(`${this.baseUrl}/create`, formData);
  }

  updateCourse(
    id: number,
    courseData: Partial<Course>,
    imageFile?: File
  ): Observable<any> {
    const formData = this.buildFormData(courseData, imageFile);
    return this.http.put(`${this.baseUrl}/${id}`, formData);
  }

  deleteCourse(courseId: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${courseId}`, {
      responseType: 'text'  // nếu backend trả về chuỗi thay vì JSON
    });
  }

  // ✅ Get course by ID - accessible to all authenticated users
  getCourseById(courseId: number): Observable<Course> {
    return this.http.get<Course>(`${this.baseUrl}/${courseId}`);
  }

  // ✅ Helper để build FormData
  private buildFormData(courseData: any, imageFile?: File): FormData {
    const formData = new FormData();
    formData.append(
      'course',
      new Blob([JSON.stringify(courseData)], { type: 'application/json' })
    );
    if (imageFile) {
      formData.append('image', imageFile);
    }
    return formData;
  }

  // ✅ Get course statistics
  getCourseStatistics(): Observable<any> {
    let headers = new HttpHeaders();
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('token');
      if (token) {
        headers = headers.set('Authorization', `Bearer ${token}`);
      }
    }
    return this.http.get<any>(`${this.baseUrl}/my-courses`, { headers });
  }

  // ✅ Get enrollment statistics
  getEnrollmentStatistics(): Observable<any> {
    let headers = new HttpHeaders();
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('token');
      if (token) {
        headers = headers.set('Authorization', `Bearer ${token}`);
      }
    }
    return this.http.get<any>(`http://localhost:8080/api/enrollments/statistics`, { headers });
  }

  // ✅ Get instructor enrollment statistics (only for instructor's courses)
  getInstructorEnrollmentStatistics(): Observable<any> {
    let headers = new HttpHeaders();
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('token');
      if (token) {
        headers = headers.set('Authorization', `Bearer ${token}`);
      }
    }
    // Try instructor-specific endpoint first, fallback to my-courses if it doesn't exist
    return this.http.get<any>(`http://localhost:8080/api/enrollments/instructor-statistics`, { headers })
      .pipe(
        catchError((error) => {
          console.log('Instructor statistics endpoint not available, using fallback method');
          return this.getInstructorCoursesWithStats();
        })
      );
  }

  // ✅ Get instructor's enrollment data by fetching all their course enrollments
  getInstructorEnrollments(): Observable<Enrollment[]> {
    let headers = new HttpHeaders();
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('token');
      if (token) {
        headers = headers.set('Authorization', `Bearer ${token}`);
      }
    }
    // Get all enrollments but filtered by instructor's courses on backend
    return this.http.get<Enrollment[]>(`http://localhost:8080/api/enrollments/instructor`, { headers })
      .pipe(
        catchError((error) => {
          console.log('Instructor enrollments endpoint not available, using fallback');
          // Fallback: get enrollments through courses
          return of([]);
        })
      );
  }

  // ✅ Get all enrollments
  getAllEnrollments(): Observable<Enrollment[]> {
    let headers = new HttpHeaders();
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('token');
      if (token) {
        headers = headers.set('Authorization', `Bearer ${token}`);
      }
    }
    return this.http.get<Enrollment[]>(`http://localhost:8080/api/enrollments`, { headers });
  }

  // ✅ Get courses with enrollment data
  getCoursesWithEnrollments(): Observable<any[]> {
    let headers = new HttpHeaders();
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('token');
      if (token) {
        headers = headers.set('Authorization', `Bearer ${token}`);
      }
    }
    return this.http.get<any[]>(`${this.baseUrl}/my-courses`, { headers });
  }

  // ✅ Get my enrolled courses
  getMyCourses(): Observable<any[]> {
    let headers = new HttpHeaders();
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('token');
      if (token) {
        headers = headers.set('Authorization', `Bearer ${token}`);
      }
    }
    // Use the courses endpoint for instructors to get their teaching courses
    return this.http.get<any[]>(`${this.baseUrl}/my-courses`, { headers });
  }

  // ✅ Get courses by date range
  getCoursesByDateRange(startDate: string, endDate: string): Observable<Course[]> {
    let headers = new HttpHeaders();
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('token');
      if (token) {
        headers = headers.set('Authorization', `Bearer ${token}`);
      }
    }
    let params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);

    return this.http.get<Course[]>(`${this.baseUrl}/date-range`, { params, headers });
  }

  // ✅ Get enrollments for a specific course (instructor can only access their own courses)
  getEnrollmentsByCourse(courseId: number): Observable<any[]> {
    console.log(`🔄 Getting enrollments for course ${courseId}...`);
    let headers = new HttpHeaders();
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('token');
      if (token) {
        headers = headers.set('Authorization', `Bearer ${token}`);
        console.log(`✅ Token added to request for course ${courseId}`);
      } else {
        console.warn(`⚠️ No token found for course ${courseId} request`);
      }
    }
    const url = `${this.baseUrl.replace('/courses', '/enrollments')}/course/${courseId}/enrollments`;
    console.log(`📡 Making request to: ${url}`);
    return this.http.get<any[]>(url, { headers }).pipe(
      map(response => {
        console.log(`✅ Raw response for course ${courseId}:`, response);
        // API trả về List<UserDTO>, chúng ta cần chuyển đổi thành enrollment format
        const enrollments = response.map((user: any, index: number) => ({
          enrollmentId: user.enrollmentId || `${courseId}_${user.userId || user.id}_${index}`,
          userId: user.userId || user.id,
          courseId: courseId,
          enrolledAt: user.enrolledAt || user.createdAt || new Date().toISOString(),
          status: user.status || 'active',
          // Thêm thông tin user
          username: user.username,
          email: user.email,
          fullName: user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim()
        }));
        console.log(`✅ Processed enrollments for course ${courseId}:`, enrollments);
        return enrollments;
      }),
      catchError(error => {
        console.error(`❌ Error getting enrollments for course ${courseId}:`, error);
        if (error.status === 403) {
          console.error(`🚫 Forbidden: Instructor may not own course ${courseId}`);
        }
        throw error;
      })
    );
  }

  // ✅ Get instructor's courses with enrollment statistics
  getInstructorCoursesWithStats(): Observable<any[]> {
    let headers = new HttpHeaders();
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('token');
      if (token) {
        headers = headers.set('Authorization', `Bearer ${token}`);
      }
    }

    // First get instructor's courses, then get enrollment stats for each
    return this.http.get<any[]>(`${this.baseUrl}/my-courses`, { headers })
      .pipe(
        switchMap((courses: any[]) => {
          if (!courses || courses.length === 0) {
            return of([]);
          }

          // Get enrollments for each course
          const enrollmentRequests = courses.map(course =>
            this.getEnrollmentsByCourse(course.courseId).pipe(
              map((enrollments: any[]) => ({
                ...course,
                enrollments: enrollments || [],
                enrollmentCount: enrollments ? enrollments.length : 0
              })),
              catchError((error) => {
                console.warn(`Failed to load enrollments for course ${course.courseId}:`, error);
                return of({
                  ...course,
                  enrollments: [],
                  enrollmentCount: 0
                });
              })
            )
          );

          return forkJoin(enrollmentRequests);
        }),
        catchError((error) => {
          console.error('Failed to load instructor courses:', error);
          return of([]);
        })
      );
  }
}
