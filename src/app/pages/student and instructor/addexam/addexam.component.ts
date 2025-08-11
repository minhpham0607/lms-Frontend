import {
  Component,
  ElementRef,
  ViewChild,
  HostListener,
  AfterViewInit,
  OnInit,
  Inject,
  PLATFORM_ID
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SessionService } from '../../../services/session.service';
import { CourseService, Course } from '../../../services/course.service';
import { ModuleService, ModuleItem } from '../../../services/module.service';
import { ExamService } from '../../../services/exam.service';
import { ProfileComponent } from '../../../components/profile/profile.component';
import { SidebarWrapperComponent } from '../../../components/sidebar-wrapper/sidebar-wrapper.component';

// Interface for exam data
export interface ExamData {
  title: string;
  description: string;
  courseId: number;
  moduleId?: number;
  quizType: 'MULTIPLE_CHOICE' | 'ESSAY';
  timeLimit: number;
  hasTimeLimit: boolean;
  shuffleAnswers: boolean;
  allowMultipleAttempts: boolean;
  maxAttempts: number;
  showQuizResponses: boolean;
  showOneQuestionAtATime: boolean;
  publish: boolean;
}

@Component({
  selector: 'app-addexam',
  standalone: true,
  templateUrl: './addexam.component.html',
  styleUrls: ['./addexam.component.scss'],
  imports: [CommonModule, FormsModule, RouterModule, ProfileComponent, SidebarWrapperComponent],
})
export class AddExamComponent implements OnInit, AfterViewInit {
  // Properties for layout and navigation
  public currentPage = 'Tests';
  public leftMenuHidden = false;
  public showProfileDropdown = false;
  public courseId: number | null = null;
  public courseInfo: Course | null = null;
  public modules: ModuleItem[] = [];
  public selectedModuleId: number | null = null;
  public activeTab: 'basic' | 'questions' | 'answers' = 'basic';
  
  // Edit mode properties
  public isEditMode = false;
  public editingQuizId: number | null = null;
  public originalQuizType: 'MULTIPLE_CHOICE' | 'ESSAY' = 'MULTIPLE_CHOICE';

  // Profile properties
  public username: string = '';
  public userRole: string = '';
  public avatarUrl: string = '';

  // Exam form data
  public examData: ExamData = {
    title: '',
    description: '',
    courseId: 0,
    quizType: 'MULTIPLE_CHOICE',
    timeLimit: 60,
    hasTimeLimit: false,
    shuffleAnswers: false,
    allowMultipleAttempts: false,
    maxAttempts: 2,
    showQuizResponses: false,
    showOneQuestionAtATime: false,
    publish: false
  };

  // Form state
  public isSaving = false;

  // Legacy properties for backward compatibility
  showDropdown = false;
  isMenuHidden = false;
  isMobile = window.innerWidth < 768;

  @ViewChild('leftMenu', { static: false }) leftMenu!: ElementRef;
  @ViewChild('toggleBtn', { static: false }) toggleBtn!: ElementRef;
  @ViewChild('contentWrapper', { static: false }) contentWrapper!: ElementRef;
  @ViewChild('searchInput', { static: false }) searchInput?: ElementRef;
  @ViewChild('noResultMessage', { static: false }) noResultMessage?: ElementRef;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private courseService: CourseService,
    private moduleService: ModuleService,
    private examService: ExamService,
    public sessionService: SessionService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  ngOnInit(): void {
    // Initialize user info
    this.username = this.sessionService.getFullName() || 'User';
    this.userRole = this.sessionService.getUserRole() || 'student';
    this.avatarUrl = '';

    // Debug logging
    console.log('🔍 AddExam component initialized');
    console.log('👤 User role:', this.userRole);
    console.log('🎓 Is Student:', this.sessionService.isStudent());
    console.log('👨‍🏫 Can Manage Content:', this.canManageContent());

    // Get courseId and edit parameters from query params
    if (isPlatformBrowser(this.platformId)) {
      this.route.queryParams.subscribe(params => {
        this.courseId = params['courseId'] ? +params['courseId'] : null;
        const courseName = params['courseName'];
        
        // Check if this is edit mode
        this.editingQuizId = params['editQuizId'] ? +params['editQuizId'] : null;
        this.isEditMode = !!this.editingQuizId;
        
        console.log('📚 Course ID from query params:', this.courseId);
        console.log('📚 Course Name from query params:', courseName);
        console.log('✏️ Edit mode:', this.isEditMode);
        console.log('✏️ Editing quiz ID:', this.editingQuizId);

        if (this.courseId) {
          this.examData.courseId = this.courseId;
          console.log('✅ Set examData.courseId to:', this.examData.courseId);
        } else {
          console.log('⚠️ No courseId found, setting to 0');
          this.examData.courseId = 0;
        }

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
          console.log('✅ Using course name from params:', decodeURIComponent(courseName));
          
          // Load modules and quiz data if in edit mode
          this.loadModules();
          if (this.isEditMode && this.editingQuizId) {
            this.loadQuizDataForEdit();
          }
        } else if (this.courseId) {
          console.log('🔄 No courseName in params, trying API fallback...');
          this.loadCourseInfo();
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

    console.log('🔄 Loading course info for courseId:', this.courseId);

    this.courseService.getCourseById(this.courseId).subscribe({
      next: (course: Course) => {
        this.courseInfo = course;
        console.log('✅ Course info loaded successfully:', course.title);
        
        // Load modules for this course
        this.loadModules();
        
        // Load quiz data if in edit mode
        if (this.isEditMode && this.editingQuizId) {
          this.loadQuizDataForEdit();
        }
      },
      error: (err: any) => {
        console.error('❌ Error loading course info:', err);

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
        console.log('🔧 Using fallback course title:', `Course ${this.courseId}`);
        
        // Still try to load modules
        this.loadModules();
      }
    });
  }

  loadModules(): void {
    if (!this.courseId) return;

    console.log('🔄 Loading modules for courseId:', this.courseId);

    this.moduleService.getModulesByCourse(this.courseId).subscribe({
      next: (modules: ModuleItem[]) => {
        this.modules = modules.sort((a, b) => a.orderNumber - b.orderNumber);
        console.log('✅ Modules loaded successfully:', this.modules.length, 'modules');
      },
      error: (err: any) => {
        console.error('❌ Error loading modules:', err);
        this.modules = [];
      }
    });
  }

  // Load quiz data for editing
  loadQuizDataForEdit(): void {
    if (!this.editingQuizId) return;

    console.log('🔄 Loading quiz data for edit, quizId:', this.editingQuizId);

    this.examService.getQuizById(this.editingQuizId).subscribe({
      next: (quiz: any) => {
        console.log('✅ Quiz data loaded for editing:', quiz);
        
        // Populate form with existing data
        this.examData = {
          title: quiz.title || '',
          description: quiz.description || '',
          courseId: quiz.courseId || this.courseId || 0,
          moduleId: quiz.moduleId || undefined,
          quizType: quiz.quizType || 'MULTIPLE_CHOICE',
          timeLimit: quiz.timeLimit || 60,
          hasTimeLimit: !!quiz.timeLimit,
          shuffleAnswers: quiz.shuffleAnswers || false,
          allowMultipleAttempts: quiz.allowMultipleAttempts || false,
          maxAttempts: quiz.maxAttempts || 2,
          showQuizResponses: quiz.showQuizResponses || false,
          showOneQuestionAtATime: quiz.showOneQuestionAtATime || false,
          publish: quiz.publish || false
        };
        
        // Store original quiz type to prevent changing it
        this.originalQuizType = this.examData.quizType;
        
        // Set selected module if exists
        if (quiz.moduleId) {
          this.selectedModuleId = quiz.moduleId;
        }
        
        console.log('📝 Form populated with quiz data:', this.examData);
      },
      error: (err: any) => {
        console.error('❌ Error loading quiz data:', err);
        alert('Không thể tải dữ liệu bài thi để chỉnh sửa: ' + (err.error?.message || err.message || 'Lỗi không xác định'));
        
        // Navigate back to exams page on error
        this.navigateBackToExams();
      }
    });
  }

  // Handle module selection
  onModuleSelectionChange(): void {
    if (this.selectedModuleId) {
      this.examData.moduleId = this.selectedModuleId;
      console.log('📝 Module selected:', this.selectedModuleId);
    } else {
      this.examData.moduleId = undefined;
      console.log('📝 Module selection cleared');
    }
  }

  // Tab management
  setActiveTab(tab: 'basic' | 'questions' | 'answers'): void {
    this.activeTab = tab;
  }

  // Form validation
  isFormValid(): boolean {
    const isValid = this.examData.title.trim().length > 0 && 
                   this.courseId !== null && 
                   this.courseId > 0 && 
                   this.examData.courseId > 0;
    
    if (!isValid) {
      console.log('❌ Form validation failed:');
      console.log('📝 Title valid:', this.examData.title.trim().length > 0);
      console.log('📚 CourseId (component):', this.courseId);
      console.log('📚 CourseId (examData):', this.examData.courseId);
    }
    
    return isValid;
  }

  // Time limit change handler
  onTimeLimitChange(event: any): void {
    if (!event.target.checked) {
      this.examData.timeLimit = 0;
    } else if (this.examData.timeLimit <= 0) {
      this.examData.timeLimit = 60; // Default to 60 minutes
    }
  }

  // Save exam (draft)
  saveExam(): void {
    if (!this.isFormValid() || this.isSaving) return;

    this.isSaving = true;
    this.examData.publish = false;

    const examDto = this.buildExamDto();

    if (this.isEditMode && this.editingQuizId) {
      // Update existing quiz - add quizId to DTO
      examDto.quizId = this.editingQuizId;
      console.log('💾 Updating existing exam as draft:', examDto);
      
      this.examService.updateQuiz(examDto).subscribe({
        next: (response: any) => {
          console.log('✅ Exam updated successfully:', response);
          this.isSaving = false;
          alert('Bài thi đã được cập nhật thành công!');
          
          // Navigate to question management page
          this.navigateToCreateQuestion(this.editingQuizId || 'new');
        },
        error: (err: any) => {
          this.handleSaveError(err);
        }
      });
    } else {
      // Create new quiz
      console.log('💾 Saving exam as draft:', examDto);
      
      this.examService.createQuiz(examDto).subscribe({
        next: (response: any) => {
          console.log('✅ Exam saved successfully:', response);
          this.isSaving = false;
          alert('Exam đã được lưu thành công!');
          
          // Navigate to question creation page
          this.navigateToCreateQuestion(response.quizId || 'new');
        },
        error: (err: any) => {
          this.handleSaveError(err);
        }
      });
    }
  }

  // Handle save errors
  private handleSaveError(err: any): void {
    console.error('❌ Error saving/updating exam:', err);
    console.error('❌ Error status:', err.status);
    console.error('❌ Error error:', err.error);
    console.error('❌ Error message:', err.message);
    this.isSaving = false;
    
    let errorMessage = `Không thể ${this.isEditMode ? 'cập nhật' : 'lưu'} exam: `;
    if (err.status === 403) {
      errorMessage += 'Không có quyền truy cập (403 Forbidden). Hãy kiểm tra quyền user hoặc đăng nhập lại.';
    } else if (err.status === 401) {
      errorMessage += 'Chưa đăng nhập (401 Unauthorized). Hãy đăng nhập lại.';
    } else if (err.status === 400) {
      errorMessage += 'Dữ liệu không hợp lệ (400 Bad Request): ' + (err.error?.message || 'Kiểm tra lại thông tin nhập');
    } else {
      errorMessage += (err.error?.message || err.message || 'Lỗi không xác định');
    }
    alert(errorMessage);
  }

  // Save and publish exam
  saveAndPublish(): void {
    if (!this.isFormValid() || this.isSaving) return;

    this.isSaving = true;
    this.examData.publish = true;

    const examDto = this.buildExamDto();

    if (this.isEditMode && this.editingQuizId) {
      // Update existing quiz and publish
      examDto.quizId = this.editingQuizId;
      console.log('📢 Updating and publishing existing exam:', examDto);
      
      this.examService.updateQuiz(examDto).subscribe({
        next: (response: any) => {
          console.log('✅ Exam updated and published successfully:', response);
          this.isSaving = false;
          alert('Bài thi đã được cập nhật và xuất bản thành công!');
          
          // Navigate to question management page
          this.navigateToCreateQuestion(this.editingQuizId || 'new');
        },
        error: (err: any) => {
          this.handleSaveError(err);
        }
      });
    } else {
      // Create new quiz and publish
      console.log('📢 Saving and publishing new exam:', examDto);
      
      this.examService.createQuiz(examDto).subscribe({
        next: (response: any) => {
          console.log('✅ Exam saved and published successfully:', response);
          this.isSaving = false;
          alert('Exam đã được lưu và xuất bản thành công!');
          
          // Navigate to question creation page
          this.navigateToCreateQuestion(response.quizId || 'new');
        },
        error: (err: any) => {
          this.handleSaveError(err);
        }
      });
    }
  }

  // Build exam DTO for API
  private buildExamDto(): any {
    const dto: any = {
      title: this.examData.title.trim(),
      description: this.examData.description.trim() || null,
      courseId: this.examData.courseId,
      moduleId: this.examData.moduleId || null,
      quizType: this.examData.quizType,
      timeLimit: this.examData.hasTimeLimit ? this.examData.timeLimit : null,
      shuffleAnswers: this.examData.shuffleAnswers,
      allowMultipleAttempts: this.examData.allowMultipleAttempts,
      maxAttempts: this.examData.maxAttempts || 2,
      showQuizResponses: this.examData.showQuizResponses,
      showOneQuestionAtATime: this.examData.showOneQuestionAtATime,
      publish: this.examData.publish
    };

    // Add quizId for update operations
    if (this.isEditMode && this.editingQuizId) {
      dto.quizId = this.editingQuizId;
    }

    console.log('🔧 Building exam DTO:');
    console.log('📝 Title:', dto.title);
    console.log('📚 CourseId:', dto.courseId);
    console.log('📂 ModuleId:', dto.moduleId);
    console.log('🧪 QuizType:', dto.quizType);
    console.log('📖 Description:', dto.description);
    console.log('⏱️ TimeLimit:', dto.timeLimit);
    console.log('🔢 MaxAttempts:', dto.maxAttempts);
    console.log('🎯 Publish:', dto.publish);
    console.log('✏️ Edit Mode:', this.isEditMode);
    console.log('🆔 Quiz ID:', dto.quizId);

    return dto;
  }

  // Cancel exam creation/editing
  cancelExam(): void {
    const actionText = this.isEditMode ? 'chỉnh sửa' : 'tạo';
    if (confirm(`Bạn có chắc chắn muốn hủy ${actionText} exam? Tất cả thông tin đã nhập sẽ bị mất.`)) {
      this.navigateBackToExams();
    }
  }

  // Navigate to create question page
  private navigateToCreateQuestion(quizId: string | number): void {
    if (this.courseId && this.courseInfo) {
      this.router.navigate(['/question-manager'], {
        queryParams: {
          courseId: this.courseId,
          courseName: encodeURIComponent(this.courseInfo.title),
          quizId: quizId,
          quizTitle: encodeURIComponent(this.examData.title),
          questionType: this.examData.quizType
        }
      });
    } else {
      console.error('❌ Cannot navigate to create question: missing courseId or courseInfo');
    }
  }

  // Navigate back to exams page
  private navigateBackToExams(): void {
    if (this.courseId && this.courseInfo) {
      this.router.navigate(['/exam'], {
        queryParams: {
          courseId: this.courseId,
          courseName: encodeURIComponent(this.courseInfo.title)
        }
      });
    } else {
      this.router.navigate(['/exam']);
    }
  }

  // Navigation methods
  navigateToHome(): void {
    console.log('navigateToHome called');
    this.currentPage = 'Home';
  }

  navigateToDiscussion(): void {
    console.log('navigateToDiscussion called');
    this.currentPage = 'Discussion';
  }

  navigateToGrades(): void {
    console.log('navigateToGrades called');
    this.currentPage = 'Grades';
  }

  navigateToModules(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    console.log('🔄 Navigating to modules...');

    if (this.courseId && this.courseInfo) {
      this.router.navigate(['/module'], {
        queryParams: {
          courseId: this.courseId,
          courseName: encodeURIComponent(this.courseInfo.title),
          page: 'Modules'
        }
      });
    } else {
      console.error('❌ Cannot navigate to modules: missing courseId or courseInfo');
    }
  }

  navigateToTests(): void {
    if (this.courseId && this.courseInfo) {
      this.router.navigate(['/exam'], {
        queryParams: {
          courseId: this.courseId,
          courseName: encodeURIComponent(this.courseInfo.title)
        }
      });
    } else {
      console.error('❌ Cannot navigate to tests: missing courseId or courseInfo');
    }
  }

  // Profile methods
  onProfileUpdate(): void {
    console.log('Profile update requested');
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

  toggleLeftMenu(): void {
    this.leftMenuHidden = !this.leftMenuHidden;
    // Legacy support
    this.isMenuHidden = this.leftMenuHidden;
  }

  toggleProfileDropdown(event?: Event): void {
    if (event) event.stopPropagation();
    this.showProfileDropdown = !this.showProfileDropdown;
    // Legacy support
    this.showDropdown = this.showProfileDropdown;
  }

  ngAfterViewInit(): void {
    if (this.searchInput && this.noResultMessage) {
      this.searchInput.nativeElement.addEventListener('input', () => {
        const keyword = this.searchInput!.nativeElement.value.toLowerCase();
        const rows = document.querySelectorAll('tbody tr');
        let found = false;

        rows.forEach((row) => {
          const quizName = row.querySelector('td')?.textContent?.toLowerCase() || '';
          if (quizName.includes(keyword)) {
            (row as HTMLElement).style.display = '';
            found = true;
          } else {
            (row as HTMLElement).style.display = 'none';
          }
        });

        this.noResultMessage!.nativeElement.style.display = found ? 'none' : 'block';
      });
    }
  }

  onQuizTypeChange(): void {
    // Reset quiz-specific options when changing quiz type
    if (this.examData.quizType === 'ESSAY') {
      this.examData.shuffleAnswers = false;
      this.examData.allowMultipleAttempts = false;
      this.examData.showQuizResponses = false;
      this.examData.showOneQuestionAtATime = false;
    }
  }

  // Check if current quiz type is multiple choice
  isMultipleChoice(): boolean {
    return this.examData.quizType === 'MULTIPLE_CHOICE';
  }

  toggleProfile(event: MouseEvent): void {
    event.stopPropagation();
    this.showDropdown = !this.showDropdown;
    this.showProfileDropdown = this.showDropdown;
  }

  updateProfile(): void {
    alert('Chuyển đến trang cập nhật hồ sơ...');
  }

  logout(): void {
    this.onLogout();
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event): void {
    const target = event.target as HTMLElement;

    if (!target.closest('.profile')) {
      this.showDropdown = false;
      this.showProfileDropdown = false;
    }

    if (this.isMobile && this.leftMenu && this.toggleBtn) {
      if (
        !this.leftMenu.nativeElement.contains(event.target) &&
        !this.toggleBtn.nativeElement.contains(event.target)
      ) {
        this.isMenuHidden = true;
        this.leftMenuHidden = true;
      }
    }
  }

  // Helper methods for template
  isStudent(): boolean {
    return this.sessionService.isStudent();
  }

  navigateToVideo(): void {
    console.log('navigateToVideo called');
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
}
