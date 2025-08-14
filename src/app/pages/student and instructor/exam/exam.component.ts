import { Component, ElementRef, HostListener, ViewChild, Inject, PLATFORM_ID, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExamService, ExamItem, ExamDto, QuestionItem } from '../../../services/exam.service';
import { CourseService, Course } from '../../../services/course.service';
import { SessionService } from '../../../services/session.service';
import { NotificationService } from '../../../services/notification.service';
import { NotificationComponent } from '../../../components/notification/notification.component';
import { ProfileComponent } from '../../../components/profile/profile.component';
import { SidebarWrapperComponent } from '../../../components/sidebar-wrapper/sidebar-wrapper.component';

@Component({
  selector: 'app-exam',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ProfileComponent, SidebarWrapperComponent, NotificationComponent],
  templateUrl: './exam.component.html',
  styleUrls: ['./exam.component.scss'],
  changeDetection: ChangeDetectionStrategy.Default
})
export class ExamComponent {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  public searchTerm = '';
  public exams: ExamItem[] = [];
  public filteredExams: ExamItem[] = [];
  public courseId: number | null = null;
  public courseInfo: Course | null = null;
  public currentPage = 'Tests';

  // Profile properties
  public username: string = '';
  public userRole: string = '';
  public avatarUrl: string = '';

  public leftMenuHidden = false;
  public showProfileDropdown = false;
  public editingExam: ExamItem | null = null;
  public selectedExamId: number | null = null;
  public uploadModalVisible = false;
  public selectedFile: string = '';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private examService: ExamService,
    private courseService: CourseService,
    public sessionService: SessionService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  ngOnInit(): void {
    // Set current page to Tests since we're on the exam page
    this.currentPage = 'Tests';

    // Initialize user info
    this.username = this.sessionService.getFullName() || 'User';
    this.userRole = this.sessionService.getUserRole() || 'student';
    this.avatarUrl = '';

    // Get courseId from query params
    if (isPlatformBrowser(this.platformId)) {
      this.route.queryParams.subscribe(params => {
        this.courseId = params['courseId'] ? +params['courseId'] : null;
        const courseName = params['courseName'];

        // If we have courseName from params, use it immediately for breadcrumb
        if (courseName && courseName.trim()) {
          this.courseInfo = {
            courseId: this.courseId!,
            title: decodeURIComponent(courseName),
            description: '',
            categoryId: 0,
            instructorId: 0,
            status: '',
            price: 0,
            thumbnailUrl: ''
          };
        } else if (this.courseId) {
          this.loadCourseInfo();
        }

        // Load exams
        if (this.courseId) {
          this.loadExams();
        }
      });
    }
  }

  // Helper method to check if current user can manage content (instructor/admin)
  canManageContent(): boolean {
    return this.sessionService.isInstructor() || this.sessionService.isAdmin();
  }

  // Load course information for breadcrumb
  loadCourseInfo(): void {
    if (!this.courseId) return;

    this.courseService.getCourseById(this.courseId).subscribe({
      next: (course: Course) => {
        this.courseInfo = course;
      },
      error: (err: any) => {
        // Fallback: Create a temporary courseInfo with generic title
        this.courseInfo = {
          courseId: this.courseId!,
          title: `Course ${this.courseId}`,
          description: '',
          categoryId: 0,
          instructorId: 0,
          status: '',
          price: 0,
          thumbnailUrl: ''
        };
      }
    });
  }

  loadExams(): void {
    if (this.courseId) {
      if (this.sessionService.isStudent()) {
        // For students, try published endpoint first (only quizzes not in modules)
        this.examService.getPublishedQuizzesByCourse(this.courseId, true).subscribe({
          next: (data: any[]) => {
            this.processExamsData(data, true);
          },
          error: (err: any) => {
            this.loadExamsWithFallback();
          }
        });
      } else {
        // For instructors/admins, load ALL quizzes (including those in modules)
        this.examService.getQuizzesByCourse(this.courseId, false).subscribe({
          next: (data: any[]) => {
            this.processExamsData(data, false);
          },
          error: (err: any) => {
            this.exams = [];
            this.filteredExams = [];
            alert('Không thể tải danh sách exams: ' + (err.error?.message || err.message || 'Unknown error'));
          }
        });
      }
    } else {
      this.exams = [];
      this.filteredExams = [];
    }
  }

  // Process exams data based on user role
  private processExamsData(data: any[], isForStudent: boolean): void {
    this.exams = data.map((e: any) => {
      return {
        quizId: e.quizId,
        courseId: e.courseId,
        title: e.title,
        description: e.description,
        quizType: e.quizType,
        timeLimit: e.timeLimit,
        shuffleAnswers: e.shuffleAnswers,
        allowMultipleAttempts: e.allowMultipleAttempts,
        showQuizResponses: e.showQuizResponses,
        showOneQuestionAtATime: e.showOneQuestionAtATime,
        dueDate: e.dueDate,
        availableFrom: e.availableFrom,
        availableUntil: e.availableUntil,
        publish: e.published !== undefined ? e.published : e.publish, // Try published first, fallback to publish
        expanded: false,
        questions: [],
        // Initialize completion status
        isCompleted: false,
        completionDate: undefined,
        score: undefined,
        attempts: 0
      };
    });

    // Filter exams for students - only show published exams
    if (isForStudent) {
      this.exams = this.exams.filter(e => e.publish === true);

      // Load completion status for each exam
      this.loadCompletionStatus();
    }

    // Sort exams by quiz ID (since orderNumber doesn't exist in backend)
    this.exams.sort((a, b) => (a.quizId || 0) - (b.quizId || 0));
    this.filteredExams = [...this.exams];

    // Load questions for all exams to determine exam type
    this.loadQuestionsForAllExams();
  }

  // Fallback method for students when published endpoint is not available
  private loadExamsWithFallback(): void {
    if (!this.courseId) return;

    this.examService.getQuizzesByCourse(this.courseId, true).subscribe({
      next: (data: any[]) => {
        this.processExamsData(data, true);
      },
      error: (err: any) => {
        this.exams = [];
        this.filteredExams = [];

        if (this.sessionService.isStudent()) {
          // Student cannot access exams - this may be normal if no published exams exist or permission denied
        } else {
          alert('Không thể tải danh sách exams: ' + (err.error?.message || err.message || 'Unknown error'));
        }
      }
    });
  }

  // Load completion status for all exams (for students)
  private loadCompletionStatus(): void {
    if (!this.sessionService.isStudent()) return;

    this.exams.forEach((exam, index) => {
      if (exam.quizId) {
        this.examService.checkExamSubmission(exam.quizId).subscribe({
          next: (response: any) => {
            if (response.success) {
              // Update exam with submission info
              this.exams[index].isCompleted = response.hasSubmitted || false;
              this.exams[index].attempts = response.attemptCount || 0;

              if (response.hasSubmitted && response.result) {
                this.exams[index].completionDate = response.result.submissionDate;
                this.exams[index].score = response.result.score;
              }

              // Update filtered exams as well
              const filteredIndex = this.filteredExams.findIndex(e => e.quizId === exam.quizId);
              if (filteredIndex !== -1) {
                this.filteredExams[filteredIndex] = { ...this.exams[index] };
              }
            } else {
              // Mark as not completed
            }
          },
          error: (err: any) => {
            // Keep isCompleted as false (default)
          }
        });
      }
    });
  }

  // Load questions for all exams to determine exam type
  private loadQuestionsForAllExams(): void {
    this.exams.forEach((exam, index) => {
      if (exam.quizId) {
        this.examService.getQuestionsByQuiz(exam.quizId).subscribe({
          next: (response: any) => {
            // Handle the response structure: {totalQuestions: number, questionTypes: string[]}
            const questionTypes = response.questionTypes || [];
            const totalQuestions = response.totalQuestions || 0;

            // Update exam with question type information
            this.exams[index].questions = questionTypes.map((questionType: string, idx: number) => {
              return {
                questionId: idx + 1,
                quizId: exam.quizId,
                questionText: '', // Not needed for type detection
                questionType: questionType,
                orderNumber: idx + 1,
                points: 1
              };
            });

            // Update filtered exams as well
            const filteredIndex = this.filteredExams.findIndex(e => e.quizId === exam.quizId);
            if (filteredIndex !== -1) {
              this.filteredExams[filteredIndex] = { ...this.exams[index] };
            }

            // Trigger change detection to update UI
            this.cdr.detectChanges();
          },
          error: (err: any) => {
            // Keep empty questions array (default)
          }
        });
      }
    });
  }

  chooseFiles(e: Event): void {
    e.stopPropagation();
    this.fileInput.nativeElement.click();
  }

  toggleProfileDropdown(event?: Event): void {
    if (event) event.stopPropagation();
    this.showProfileDropdown = !this.showProfileDropdown;
  }

  updateProfile(): void {
    this.notificationService.info('Thông báo', 'Chuyển đến trang cập nhật hồ sơ...');
  }

  logout(): void {
    // SessionService sẽ xử lý việc hiển thị notification và chuyển hướng
    this.sessionService.logout();
  }

  redirectToExamPage(): void {
    this.router.navigate(['/addexam']);
  }

  searchExams(): void {
    const keyword = this.searchTerm.toLowerCase();
    this.filteredExams = this.exams.filter(e =>
      e.title.toLowerCase().includes(keyword) ||
      (e.description && e.description.toLowerCase().includes(keyword))
    );
  }

  // Handle exam click - different behavior for instructor vs student
  handleExamClick(exam: ExamItem): void {
    if (this.canManageContent()) {
      // Instructor: Navigate to question management page
      this.navigateToQuestionManager(exam);
    } else {
      // Student: Navigate to take exam page
      this.navigateToTakeExam(exam);
    }
  }

  // Navigate to question manager for instructors
  navigateToQuestionManager(exam: ExamItem): void {
    if (this.courseId && this.courseInfo && exam.quizId) {
      this.router.navigate(['/question-manager'], {
        queryParams: {
          courseId: this.courseId,
          courseName: encodeURIComponent(this.courseInfo.title),
          quizId: exam.quizId,
          quizTitle: encodeURIComponent(exam.title),
          questionType: exam.quizType || 'MULTIPLE_CHOICE'
        }
      });
    }
  }

  // Navigate to take exam page for students
  navigateToTakeExam(exam: ExamItem): void {
    if (this.courseId && this.courseInfo && exam.quizId) {
      this.router.navigate(['/take-exam'], {
        queryParams: {
          courseId: this.courseId,
          courseName: encodeURIComponent(this.courseInfo.title),
          quizId: exam.quizId,
          quizTitle: encodeURIComponent(exam.title),
          questionType: exam.quizType || 'MULTIPLE_CHOICE',
          returnTo: 'exam' // Indicate that student came from exam page
        }
      });
    } else {
      alert(`Không thể tải bài thi "${exam.title}". Vui lòng thử lại!`);
    }
  }

  // Toggle exam published status
  togglePublishStatus(exam: ExamItem): void {
    if (!this.canManageContent()) return;

    const newStatus = !exam.publish;
    const statusText = newStatus ? 'đã xuất bản' : 'đã chuyển về bản nháp';

    // Show confirmation dialog
    const confirmMessage = newStatus
      ? `Bạn có chắc chắn muốn xuất bản bài thi "${exam.title}"?`
      : `Bạn có chắc chắn muốn chuyển bài thi "${exam.title}" về bản nháp?`;

    if (!confirm(confirmMessage)) {
      return;
    }

    // Store original status for rollback
    const originalStatus = exam.publish;

    // Update the exam object immediately for UI feedback
    exam.publish = newStatus;

    // Call API to update only the status (more efficient)
    if (exam.quizId) {
      this.examService.updateQuizStatus(exam.quizId, newStatus).subscribe({
        next: () => {
          // Show success message
          alert(`Bài thi "${exam.title}" ${statusText} thành công!`);

          // Reload exams to ensure UI consistency with database
          this.loadExams();
        },
        error: (error: any) => {
          // Revert the status on error
          exam.publish = originalStatus;
          alert('Có lỗi xảy ra khi cập nhật trạng thái bài thi!');
        }
      });
    }
  }

  // Edit exam - redirect to addexam page with quiz data for editing
  editExam(exam: ExamItem): void {
    if (exam.quizId && this.courseId && this.courseInfo) {
      // Navigate to addexam page with edit parameters
      this.router.navigate(['/addexam'], {
        queryParams: {
          courseId: this.courseId,
          courseName: encodeURIComponent(this.courseInfo.title),
          editQuizId: exam.quizId,
          quizTitle: encodeURIComponent(exam.title)
        }
      });
    } else {
      alert('Không tìm thấy thông tin cần thiết để chỉnh sửa bài thi.');
    }
  }

  // Toggle exam expanded state for viewing details (kept for backwards compatibility)
  toggleExamExpanded(exam: ExamItem): void {
    exam.expanded = !exam.expanded;

    // Load questions when expanding
    if (exam.expanded && exam.quizId) {
      this.loadExamQuestions(exam.quizId);
    }
  }

  // Load questions for an exam
  loadExamQuestions(quizId: number): void {
    // For now, just set empty questions since questions endpoint might not be implemented
    const exam = this.exams.find(e => e.quizId === quizId);
    if (exam) {
      exam.questions = [];
    }
  }

  // Navigate to add exam page
  showAddExam(): void {
    if (!this.canManageContent()) {
      alert('Bạn không có quyền tạo exam mới.');
      return;
    }

    // Navigate to add exam page with course info
    if (this.courseId && this.courseInfo) {
      this.router.navigate(['/addexam'], {
        queryParams: {
          courseId: this.courseId,
          courseName: encodeURIComponent(this.courseInfo.title)
        }
      });
    } else {
      // Cannot navigate to add exam: missing courseId or courseInfo
    }
  }

  // Delete exam (keeping this for instructors/admins)
  deleteExam(exam: ExamItem): void {
    if (!this.canManageContent()) {
      alert('Bạn không có quyền xóa exam.');
      return;
    }

    if (!exam.quizId) return;

    if (confirm(`Bạn có chắc chắn muốn xóa exam "${exam.title}"?`)) {
      this.examService.deleteQuiz(exam.quizId).subscribe({
        next: (response: any) => {
          this.loadExams();
          alert('Exam đã được xóa thành công!');
        },
        error: (err: any) => {
          alert('Không thể xóa exam: ' + (err.error?.message || err.message || 'Unknown error'));
        }
      });
    }
  }

  // Navigation methods - Actual routing between pages
  navigateToHome(): void {
    if (this.courseId) {
      this.router.navigate(['/course-home'], { queryParams: { courseId: this.courseId } });
    } else {
      this.router.navigate(['/course-home']);
    }
  }

  navigateToDiscussion(): void {
    if (this.courseId) {
      this.router.navigate(['/discussion'], { queryParams: { courseId: this.courseId } });
    }
  }

  navigateToGrades(): void {
    if (this.courseId) {
      // Check if user is instructor/admin
      if (this.canManageContent()) {
        // Navigate to instructor grades management page
        this.router.navigate(['/grades'], { queryParams: { courseId: this.courseId } });
      } else {
        // Navigate to student grades view page
        this.router.navigate(['/student-grades'], { queryParams: { courseId: this.courseId } });
      }
    }
  }

  navigateToVideo(): void {
    if (this.courseId) {
      // Check if user is instructor/admin
      if (this.canManageContent()) {
        // Navigate to video upload page for instructors
        this.router.navigate(['/video-upload'], { queryParams: { courseId: this.courseId } });
      } else {
        // Navigate to learn online page for students
        this.router.navigate(['/learn-online'], { queryParams: { courseId: this.courseId } });
      }
    }
  }

  navigateToTests(): void {
    if (this.courseId) {
      this.router.navigate(['/exam'], { queryParams: { courseId: this.courseId } });
    }
  }

  // Profile methods
  onProfileUpdate(): void {
    // Profile update requested
  }

  onLogout(): void {
    this.sessionService.logout();
    this.router.navigate(['/login']);
  }

  getDisplayRole(role: string): string {
    if (!role) return 'User';
    const cleanRole = role.replace('ROLE_', '');
    return cleanRole.charAt(0).toUpperCase() + cleanRole.slice(1).toLowerCase();
  }

  navigateToModules(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (this.courseId) {
      this.router.navigate(['/module'], { queryParams: { courseId: this.courseId } });
    } else {
      // Cannot navigate to modules: missing courseId
    }
  }

  navigateToAnnouncements(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (this.courseId && this.courseInfo) {
      this.router.navigate(['/announcements'], {
        queryParams: {
          courseId: this.courseId,
          courseName: encodeURIComponent(this.courseInfo.title)
        }
      });
    } else {
      // Cannot navigate to announcements: missing courseId or courseInfo
    }
  }

  navigateToDashboard(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    this.router.navigate(['/dashboard']);
  }

  handleModalClick(event: MouseEvent): void {
    event.stopPropagation();
  }

  triggerFileInput(): void {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const files = (event.target as HTMLInputElement).files;
    if (files && files.length > 0) {
      const fileName = files[0].name;
      this.selectedFile = fileName;
    }
  }

  onFileChange(event: Event): void {
    this.onFileSelected(event);
  }

  openUploadModal(): void {
    this.uploadModalVisible = true;
  }

  toggleLeftMenu(): void {
    this.leftMenuHidden = !this.leftMenuHidden;
  }

  // Get exam type based on questions
  getExamType(exam: ExamItem): string {
    if (!exam.questions || exam.questions.length === 0) {
      return 'Trắc nghiệm'; // Default to multiple choice if no questions loaded yet
    }

    const hasEssay = exam.questions.some(q => {
      // Check for both 'essay' and 'ESSAY' formats
      return q.questionType === 'essay' || q.questionType === 'ESSAY';
    });

    // If any question is essay, it's an essay exam
    // Otherwise, it's multiple choice
    const examType = hasEssay ? 'Tự luận' : 'Trắc nghiệm';

    return examType;
  }

  // Get exam type icon
  getExamTypeIcon(exam: ExamItem): string {
    const type = this.getExamType(exam);
    return type === 'Tự luận' ? 'fas fa-pen-fancy' : 'fas fa-list-ul';
  }

  // Get exam type color class
  getExamTypeClass(exam: ExamItem): string {
    const type = this.getExamType(exam);
    return type === 'Tự luận' ? 'type-essay' : 'type-multiple-choice';
  }

  // Helper method for template
  isStudent(): boolean {
    return this.sessionService.isStudent();
  }
}
