import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { ApiService } from '../../../services/api.service';
import { ExamService } from '../../../services/exam.service';
import { CourseService } from '../../../services/course.service';
import { NotificationService } from '../../../services/notification.service';
import { NotificationComponent } from '../../../components/notification/notification.component';
import { SidebarWrapperComponent } from '../../../components/sidebar-wrapper/sidebar-wrapper.component';
import { ProfileComponent } from '../../../components/profile/profile.component';
import { UserService } from '../../../services/user.service';
import { SessionService } from '../../../services/session.service';

interface StudentGrade {
  attemptId: number;
  quizId: number;
  quizTitle: string;
  quizType: string;
  score: number;
  maxScore: number;
  submittedAt: string;
  status: string;
  courseName: string;
  feedback?: string;
}

interface EssaySubmission {
  attemptId: number;
  quizTitle: string;
  submittedAt: string;
  totalQuestions: number;
  gradedCount: number;
  totalScore: number;
  maxScore: number;
  isFullyGraded: boolean;
  questions: any[];
  answers: any[];
}

@Component({
  selector: 'app-student-grades',
  standalone: true,
  imports: [CommonModule, NotificationComponent, SidebarWrapperComponent, ProfileComponent],
  templateUrl: './student-grades.component.html',
  styleUrl: './student-grades.component.scss'
})
export class StudentGradesComponent implements OnInit {
  grades: StudentGrade[] = [];
  filteredGrades: StudentGrade[] = [];
  isLoading = true;
  activeTab = 'ALL'; // ALL, MULTIPLE_CHOICE, ESSAY

  // Navigation state
  currentPage: string = 'Grades';
  leftMenuHidden: boolean = false;
  courseId: number | null = null;
  courseInfo: any = null;

  // Profile component properties
  username: string = '';
  userRole: string = '';
  avatarUrl: string = '';

  // For essay submission modal
  selectedSubmission?: EssaySubmission;
  isLoadingSubmission = false;

  constructor(
    private apiService: ApiService,
    private examService: ExamService,
    private courseService: CourseService,
    private notificationService: NotificationService,
    private userService: UserService,
    private sessionService: SessionService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.initializeUserProfile();
    // Get courseId from route params
    this.route.queryParams.subscribe(params => {
      this.courseId = params['courseId'] ? +params['courseId'] : null;

      // If no courseId from route, try to get it from other sources
      if (!this.courseId) {
        this.attemptToGetCourseId();
      } else {
        // Load course info if courseId exists
        this.loadCourseInfo();
      }
    });
    this.loadGrades();
  }

  // Attempt to get courseId from other sources
  attemptToGetCourseId(): void {

    // Try to get from localStorage if previously stored
    const storedCourseId = localStorage.getItem('lastCourseId');
    if (storedCourseId) {
      this.courseId = +storedCourseId;
      this.loadCourseInfo();
      return;
    }

    // If still no courseId, try to get first enrolled course
    this.loadFirstEnrolledCourse();
  }

  // Load first enrolled course if no courseId available
  loadFirstEnrolledCourse(): void {
    this.apiService.get('/courses/enrolled').subscribe({
      next: (response: any) => {
        const courses = Array.isArray(response) ? response : response.data || [];
        if (courses.length > 0) {
          this.courseId = courses[0].courseId || courses[0].id;
          // Store for future use
          if (this.courseId) {
            localStorage.setItem('lastCourseId', this.courseId.toString());
          }
          this.loadCourseInfo();
        }
      },
      error: (error) => {
        // Error loading enrolled courses
      }
    });
  }

  // Initialize user profile
  initializeUserProfile(): void {
    const userInfo = this.userService.getCurrentUserInfo();
    this.username = userInfo.username;
    this.userRole = userInfo.role;
    this.avatarUrl = userInfo.avatarUrl;
  }

  // Format role để hiển thị (chữ cái đầu viết hoa)
  getDisplayRole(role: string): string {
    const cleanRole = role.replace('ROLE_', '').toLowerCase();
    return cleanRole.charAt(0).toUpperCase() + cleanRole.slice(1);
  }

  onProfileUpdate(): void {
    this.initializeUserProfile();
  }

  onLogout(): void {
    this.sessionService.logout();
  }

  // Navigation methods
  toggleLeftMenu(): void {
    this.leftMenuHidden = !this.leftMenuHidden;
  }

  navigateToHome(): void {
    if (this.courseId) {
      this.router.navigate(['/course-home'], { queryParams: { courseId: this.courseId } });
    }
  }

  navigateToDiscussion(): void {
    if (this.courseId) {
      this.router.navigate(['/discussion'], { queryParams: { courseId: this.courseId } });
    }
  }

  navigateToGrades(): void {
    if (this.courseId) {
      this.router.navigate(['/student-grades'], { queryParams: { courseId: this.courseId } });
    }
  }

  navigateToModules(): void {
    if (this.courseId) {
      this.router.navigate(['/module'], { queryParams: { courseId: this.courseId } });
    }
  }

  navigateToVideo(): void {
    if (this.courseId) {
      // Students should go to learn-online (this component is for students)
      this.router.navigate(['/learn-online'], { queryParams: { courseId: this.courseId } });
    }
  }

  navigateToTests(): void {
    if (this.courseId) {
      this.router.navigate(['/exam'], { queryParams: { courseId: this.courseId } });
    }
  }

  // Load course information
  loadCourseInfo(): void {
    if (!this.courseId) return;

    this.courseService.getCourseById(this.courseId).subscribe({
      next: (course) => {
        this.courseInfo = course;
      },
      error: (error) => {
        // Error loading course info
      }
    });
  }

  // Helper method để hiển thị thông báo
  private showAlert(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
    if (type === 'success') {
      this.notificationService.success('Thành công', message);
    } else if (type === 'error') {
      this.notificationService.error('Lỗi', message);
    } else if (type === 'warning') {
      this.notificationService.warning('Cảnh báo', message);
    } else {
      this.notificationService.info('Thông báo', message);
    }
  }

  // Get correct answers count from score
  getCorrectAnswers(grade: StudentGrade): number {
    // Backend now returns actual score (correct answers count)
    return grade.score || 0;
  }

  // Get percentage score
  getPercentage(grade: StudentGrade): number {
    const score = grade.score || 0;
    const maxScore = grade.maxScore || 1;
    return maxScore > 0 ? (score / maxScore) * 100 : 0;
  }

  loadGrades() {
    this.isLoading = true;

    this.apiService.get('/grades/student').subscribe({
      next: (response: any) => {
        if (response.success) {
          this.grades = response.grades;
          this.filterGrades();
        } else {
          this.showAlert('Lỗi khi tải điểm của bạn: ' + response.message, 'error');
        }

        this.isLoading = false;
      },
      error: (error) => {
        this.showAlert('Lỗi khi tải điểm của bạn!', 'error');
        this.isLoading = false;
      }
    });
  }

  changeTab(tab: string) {
    this.activeTab = tab;
    this.filterGrades();
  }

  filterGrades() {
    if (this.activeTab === 'ALL') {
      this.filteredGrades = [...this.grades];
    } else {
      this.filteredGrades = this.grades.filter(grade => grade.quizType === this.activeTab);
    }
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'COMPLETED': return 'badge bg-success';
      case 'PENDING_GRADE': return 'badge bg-warning';
      case 'NOT_SUBMITTED': return 'badge bg-secondary';
      default: return 'badge bg-secondary';
    }
  }

  getScoreClass(score: number, maxScore: number): string {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) return 'score-excellent';
    if (percentage >= 60) return 'score-good';
    if (percentage >= 40) return 'score-average';
    return 'score-poor';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString('vi-VN');
  }

  // View essay submission details
  viewEssaySubmission(grade: StudentGrade) {
    // Show modal with animation
    this.selectedSubmission = {} as EssaySubmission; // Placeholder to show modal
    this.isLoadingSubmission = true;

    // Small delay for smooth animation
    setTimeout(() => {
      // Use the exam result endpoint which should work for students
      this.examService.getExamResult(grade.quizId).subscribe({
        next: (response: any) => {
          // Check if response has data (the API returns data directly)
          if (response && (response.attemptId || response.questionResults)) {
            // Transform the exam result data to our EssaySubmission format
            this.selectedSubmission = {
              attemptId: response.attemptId || grade.attemptId,
              quizTitle: grade.quizTitle,
              submittedAt: grade.submittedAt,
              totalQuestions: response.questionResults?.length || 0,
              gradedCount: response.questionResults?.filter((q: any) => q.score !== null && q.score !== undefined).length || 0,
              totalScore: response.earnedPoints || grade.score,
              maxScore: response.totalPoints || grade.maxScore,
              isFullyGraded: true, // Assume fully graded if we have results
              questions: response.questionResults || [],
              answers: response.questionResults || []
            };
          } else if (response.success) {
            // Handle wrapped response format (backup)
            this.selectedSubmission = {
              attemptId: grade.attemptId,
              quizTitle: grade.quizTitle,
              submittedAt: grade.submittedAt,
              totalQuestions: response.examResult?.totalQuestions || 0,
              gradedCount: response.examResult?.gradedQuestions || 0,
              totalScore: response.examResult?.totalScore || grade.score,
              maxScore: response.examResult?.maxScore || grade.maxScore,
              isFullyGraded: response.examResult?.isFullyGraded || false,
              questions: response.examResult?.questions || [],
              answers: response.examResult?.answers || []
            };
          } else {
            this.showAlert('Lỗi khi tải chi tiết bài làm: Định dạng dữ liệu không hợp lệ', 'error');
            this.closeEssayModal();
          }

          this.isLoadingSubmission = false;
        },
        error: (error) => {
          // Fallback: try the original endpoint in case it works for some users
          this.tryOriginalEndpoint(grade);
        }
      });
    }, 100);
  }

  // Fallback method to try the original endpoint
  private tryOriginalEndpoint(grade: StudentGrade) {
    this.apiService.get(`/grades/student/essay-submission/${grade.attemptId}`).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.selectedSubmission = response.submission;
        } else {
          this.showAlert('Lỗi khi tải chi tiết bài làm: ' + response.message, 'error');
          this.closeEssayModal();
        }

        this.isLoadingSubmission = false;
      },
      error: (error) => {
        this.showAlert('Không thể tải chi tiết bài làm. Vui lòng thử lại sau!', 'error');
        this.isLoadingSubmission = false;
        this.closeEssayModal();
      }
    });
  }

  // Close essay submission modal with animation
  closeEssayModal() {
    if (this.selectedSubmission) {
      // Add fade out animation
      this.selectedSubmission = undefined;
    }
  }

  // Get answer for a specific question
  getAnswerForQuestion(questionId: number): any {
    if (!this.selectedSubmission) return null;

    return this.selectedSubmission.answers.find(answer =>
      answer.question && answer.question.questionId === questionId
    );
  }

  // Get score display for essay
  getEssayScoreDisplay(submission: EssaySubmission): string {
    if (!submission.isFullyGraded) {
      return `${submission.gradedCount}/${submission.totalQuestions} câu đã chấm`;
    }
    return `${submission.totalScore}/${submission.maxScore} điểm`;
  }

  // Get percentage for essay
  getEssayPercentage(submission: EssaySubmission): number {
    if (!submission.isFullyGraded || submission.maxScore === 0) return 0;
    return (submission.totalScore / submission.maxScore) * 100;
  }

  isStudent(): boolean {
    return this.sessionService.getUserRole() === 'ROLE_student';
  }

  // Show feedback modal
  showFeedbackModal(grade: StudentGrade): void {
    if (grade.feedback) {
      alert(`Nhận xét từ giảng viên:\n\n${grade.feedback}`);
    } else {
      this.showAlert('Bài này chưa có nhận xét từ giảng viên', 'info');
    }
  }
}
