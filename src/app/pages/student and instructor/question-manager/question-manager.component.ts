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
import { ExamService } from '../../../services/exam.service';
import { NotificationService } from '../../../services/notification.service';
import { ProfileComponent } from '../../../components/profile/profile.component';
import { SidebarWrapperComponent } from '../../../components/sidebar-wrapper/sidebar-wrapper.component';
import { NotificationComponent } from '../../../components/notification/notification.component';

// Interface for question data
export interface QuestionData {
  id?: string; // Temporary ID for tracking
  questionId?: number; // Real database ID
  quizId: number;
  questionText: string;
  questionType: 'MULTIPLE_CHOICE' | 'ESSAY';
  options?: string[]; // For multiple choice
  correctAnswers?: boolean[]; // For multiple choice
  attachmentUrl?: string; // For essay questions
  questionFileUrl?: string; // File URL for essay questions
  questionFileName?: string; // Original file name for essay questions
  points: number;
  explanation?: string;
}

@Component({
  selector: 'app-question-manager',
  standalone: true,
  templateUrl: './question-manager.component.html',
  styleUrls: ['./question-manager.component.scss'],
  imports: [CommonModule, FormsModule, RouterModule, ProfileComponent, SidebarWrapperComponent, NotificationComponent],
})
export class QuestionManagerComponent implements OnInit, AfterViewInit {
  // Properties for layout and navigation
  public currentPage = 'Tests';
  public leftMenuHidden = false;
  public showProfileDropdown = false;
  public courseId: number | null = null;
  public quizId: number | null = null;
  public courseInfo: Course | null = null;
  public quizTitle: string = '';
  public quizType: 'MULTIPLE_CHOICE' | 'ESSAY' = 'MULTIPLE_CHOICE';

  // Profile properties
  public username: string = '';
  public userRole: string = '';
  public avatarUrl: string = '';

  // Questions management
  public questions: QuestionData[] = [];
  public currentQuestionIndex = 0;
  public isEditing = false;

  // Current question being edited
  public currentQuestion: QuestionData = this.createNewQuestion();

  // For radio button selection of correct answer (only one correct answer allowed)
  public selectedCorrectAnswerIndex: number | null = null;

  // Form state
  public isSaving = false;
  public selectedFile: File | null = null;

  // Modal state
  public showConfirmModal = false;
  public confirmModalTitle = '';
  public confirmModalMessage = '';
  public confirmModalCallback: (() => void) | null = null;

  // Delete confirmation modal state
  public showDeleteModal = false;
  public deleteModalTitle = '';
  public deleteModalMessage = '';
  public deleteModalCallback: (() => void) | null = null;

  // Multi-select delete state
  public isMultiSelectMode = false;
  public selectedQuestionIds: Set<number> = new Set();
  public showBulkDeleteModal = false;

  // Validation optimization
  private validationTimeout: any = null;

  // Legacy properties for backward compatibility
  showDropdown = false;
  isMenuHidden = false;
  isMobile = false;

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

  // Helper method để hiển thị modal xác nhận
  private displayConfirmModal(title: string, message: string, callback: () => void) {
    this.confirmModalTitle = title;
    this.confirmModalMessage = message;
    this.confirmModalCallback = callback;
    this.showConfirmModal = true;
  }

  // Helper method để hiển thị modal xóa
  private displayDeleteModal(title: string, message: string, callback: () => void) {
    this.deleteModalTitle = title;
    this.deleteModalMessage = message;
    this.deleteModalCallback = callback;
    this.showDeleteModal = true;
  }

  // Xử lý xác nhận modal
  public onConfirmModalOk(): void {
    this.showConfirmModal = false;
    if (this.confirmModalCallback) {
      this.confirmModalCallback();
      this.confirmModalCallback = null;
    }
  }

  // Xử lý hủy modal
  public onConfirmModalCancel(): void {
    this.showConfirmModal = false;
    this.confirmModalCallback = null;
  }

  // Xử lý xác nhận xóa
  public onDeleteModalOk(): void {
    this.showDeleteModal = false;
    if (this.deleteModalCallback) {
      this.deleteModalCallback();
      this.deleteModalCallback = null;
    }
  }

  // Xử lý hủy xóa
  public onDeleteModalCancel(): void {
    this.showDeleteModal = false;
    this.deleteModalCallback = null;
  }

  // Toggle multi-select mode
  public toggleMultiSelectMode(): void {
    this.isMultiSelectMode = !this.isMultiSelectMode;
    if (!this.isMultiSelectMode) {
      // Clear selections when exiting multi-select mode
      this.selectedQuestionIds.clear();
    }
  }

  // Toggle question selection
  public toggleQuestionSelection(index: number): void {
    if (this.selectedQuestionIds.has(index)) {
      this.selectedQuestionIds.delete(index);
    } else {
      this.selectedQuestionIds.add(index);
    }
  }

  // Check if question is selected
  public isQuestionSelected(index: number): boolean {
    return this.selectedQuestionIds.has(index);
  }

  // Select all questions
  public selectAllQuestions(): void {
    for (let i = 0; i < this.questions.length; i++) {
      this.selectedQuestionIds.add(i);
    }
  }

  // Deselect all questions
  public deselectAllQuestions(): void {
    this.selectedQuestionIds.clear();
  }

  // Delete selected questions
  public deleteSelectedQuestions(): void {
    if (this.selectedQuestionIds.size === 0) {
      this.showAlert('Vui lòng chọn ít nhất một câu hỏi để xóa!', 'warning');
      return;
    }

    // Check if trying to delete all questions in essay quiz
    if (this.quizType === 'ESSAY' && this.selectedQuestionIds.size >= this.questions.length) {
      this.showAlert('Đề thi tự luận phải có ít nhất 1 câu hỏi!', 'warning');
      return;
    }

    const message = `Bạn có chắc chắn muốn xóa ${this.selectedQuestionIds.size} câu hỏi đã chọn?`;
    this.displayDeleteModal('Xác nhận xóa nhiều câu hỏi', message, () => {
      this.performBulkDelete();
    });
  }

  // Perform bulk delete operation
  private performBulkDelete(): void {
    const selectedIndices = Array.from(this.selectedQuestionIds).sort((a, b) => b - a); // Sort in descending order for safe deletion
    let deletedCount = 0;
    let totalToDelete = selectedIndices.length;

    selectedIndices.forEach((index) => {
      const questionToDelete = this.questions[index];
      
      if (questionToDelete.questionId) {
        // Delete from database
        this.examService.deleteQuestion(questionToDelete.questionId).subscribe({
          next: (response: any) => {
            this.removeQuestionFromListSilently(index);
            deletedCount++;
            this.checkBulkDeleteComplete(deletedCount, totalToDelete);
          },
          error: (error: any) => {
            console.error('❌ Error deleting question from database:', error);
            this.removeQuestionFromListSilently(index);
            deletedCount++;
            this.checkBulkDeleteComplete(deletedCount, totalToDelete);
          }
        });
      } else {
        // Just remove from local list
        this.removeQuestionFromListSilently(index);
        deletedCount++;
        this.checkBulkDeleteComplete(deletedCount, totalToDelete);
      }
    });
  }

  // Check if bulk delete is complete
  private checkBulkDeleteComplete(deletedCount: number, totalToDelete: number): void {
    if (deletedCount === totalToDelete) {
      this.selectedQuestionIds.clear();
      this.isMultiSelectMode = false;
      this.showAlert(`Đã xóa thành công ${totalToDelete} câu hỏi!`, 'success');
      
      // Reset current question if needed
      if (this.questions.length > 0) {
        this.currentQuestionIndex = Math.max(0, Math.min(this.currentQuestionIndex, this.questions.length - 1));
        this.currentQuestion = { ...this.questions[this.currentQuestionIndex] };
        this.updateSelectedCorrectAnswerIndex();
      } else {
        this.currentQuestion = this.createNewQuestion();
        this.currentQuestionIndex = 0;
        this.isEditing = false;
      }
    }
  }

  // Remove question from list without UI updates (for bulk operations)
  private removeQuestionFromListSilently(index: number): void {
    if (index >= 0 && index < this.questions.length) {
      this.questions.splice(index, 1);
    }
  }

  @ViewChild('leftMenu', { static: false }) leftMenu!: ElementRef;
  @ViewChild('toggleBtn', { static: false }) toggleBtn!: ElementRef;
  @ViewChild('contentWrapper', { static: false }) contentWrapper!: ElementRef;
  @ViewChild('questionTextArea', { static: false }) questionTextArea?: ElementRef;
  @ViewChild('fileInput', { static: false }) fileInput?: ElementRef;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private courseService: CourseService,
    private examService: ExamService,
    public sessionService: SessionService,
    private notificationService: NotificationService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  ngOnInit(): void {
    // Initialize user info
    this.username = this.sessionService.getFullName() || 'User';
    this.userRole = this.sessionService.getUserRole() || 'student';
    this.avatarUrl = '';

    // Check if running in browser and set mobile flag
    if (typeof window !== 'undefined') {
      this.isMobile = window.innerWidth < 768;
    }

    // Get parameters from query params
    if (isPlatformBrowser(this.platformId)) {
      this.route.queryParams.subscribe(params => {
        this.courseId = params['courseId'] ? +params['courseId'] : null;
        this.quizId = params['quizId'] ? +params['quizId'] : null;
        this.quizTitle = params['quizTitle'] ? decodeURIComponent(params['quizTitle']) : 'Quiz';
        this.quizType = params['questionType'] as 'MULTIPLE_CHOICE' | 'ESSAY' || 'MULTIPLE_CHOICE';
        const courseName = params['courseName'];

        // Set course info from params
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

        // Initialize first question
        this.currentQuestion = this.createNewQuestion();
        
        // Load existing questions if editing
        if (this.quizId) {
          this.loadExistingQuestions();
        } else {
          // Add first question to the list immediately so it shows at index 0
          if (this.questions.length === 0) {
            this.createAndAddFirstQuestion();
          }
        }
      });
    }
  }

  // Load existing questions for editing
  private loadExistingQuestions(): void {
    if (!this.quizId) return;

    // Try to use the quiz with questions endpoint
    this.examService.getQuizWithQuestions(this.quizId).subscribe({
      next: (response: any) => {
        const questions = response.questions || [];
        
        if (questions && questions.length > 0) {
          // Convert backend questions to frontend format
          this.questions = questions.map((q: any) => this.convertFromBackendQuestion(q));
          this.currentQuestionIndex = 0;
          this.currentQuestion = { ...this.questions[0] };
          this.isEditing = true;
          
          // Update selected correct answer index for loaded question
          this.updateSelectedCorrectAnswerIndex();
          
        } else {
          // No existing questions, add first new question
          this.createAndAddFirstQuestion();
        }
      },
      error: (error: any) => {
        console.error('❌ Error loading questions:', error);
        // If error loading, just start with new question
        this.createAndAddFirstQuestion();
      }
    });
  }

  // Fallback method to load questions directly
  private loadQuestionsDirectly(): void {
    this.examService.getQuestionsForEditing(this.quizId!).subscribe({
      next: (questions: any[]) => {
        if (questions && questions.length > 0) {
          // Convert backend questions to frontend format
          this.questions = questions.map((q: any) => this.convertFromBackendQuestion(q));
          this.currentQuestionIndex = 0;
          this.currentQuestion = { ...this.questions[0] };
          this.isEditing = true;
          
          // Update selected correct answer index for loaded question
          this.updateSelectedCorrectAnswerIndex();
          
        } else {
          // No existing questions, add first new question
          this.createAndAddFirstQuestion();
        }
      },
      error: (error: any) => {
        console.error('❌ Error loading questions directly:', error);
        // If still error, just start with new question
        this.createAndAddFirstQuestion();
      }
    });
  }

  // Convert backend question to frontend format
  private convertFromBackendQuestion(backendQ: any): QuestionData {
    const questionData: QuestionData = {
      id: `db_${backendQ.questionId}`,
      questionId: backendQ.questionId,
      quizId: backendQ.quizId || this.quizId || 0,
      questionText: backendQ.questionText || '',
      questionType: backendQ.type || 'MULTIPLE_CHOICE',
      points: backendQ.points || 1,
      explanation: backendQ.explanation || ''
    };

    // Nếu là trắc nghiệm và có answers
    if (backendQ.type === 'MULTIPLE_CHOICE' && backendQ.answers && backendQ.answers.length > 0) {
      questionData.options = [];
      questionData.correctAnswers = [];
      
      // Sort answers by orderNumber - fix null check
      const sortedAnswers = backendQ.answers
        .filter((answer: any) => answer !== null && answer !== undefined)
        .sort((a: any, b: any) => 
          (a?.orderNumber || 0) - (b?.orderNumber || 0)
        );
      
      sortedAnswers.forEach((answer: any) => {
        if (answer) {
          questionData.options!.push(answer.answerText || '');
          questionData.correctAnswers!.push(answer.isCorrect || false);
        }
      });

      // Đảm bảo ít nhất có 4 options
      while (questionData.options!.length < 4) {
        questionData.options!.push('');
        questionData.correctAnswers!.push(false);
      }
    } else if (backendQ.type === 'MULTIPLE_CHOICE') {
      // Trắc nghiệm nhưng chưa có answers
      questionData.options = ['', '', '', ''];
      questionData.correctAnswers = [false, false, false, false];
    }

    return questionData;
  }

  // Create new question template
  private createNewQuestion(): QuestionData {
    // Reset selected correct answer index when creating new question
    this.selectedCorrectAnswerIndex = null;
    
    return {
      id: 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      quizId: this.quizId || 0,
      questionText: '',
      questionType: this.quizType,
      options: this.quizType === 'MULTIPLE_CHOICE' ? ['', '', '', ''] : undefined,
      correctAnswers: this.quizType === 'MULTIPLE_CHOICE' ? [false, false, false, false] : undefined,
      points: 1,
      explanation: ''
    };
  }

  // Load course information
  loadCourseInfo(): void {
    if (!this.courseId) return;

    this.courseService.getCourseById(this.courseId).subscribe({
      next: (course: Course) => {
        this.courseInfo = course;
      },
      error: (err: any) => {
        console.error('❌ Error loading course info:', err);
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

  // Add new question
  addNewQuestion(): void {
    // Ngăn thêm câu hỏi mới nếu là đề thi tự luận
    if (this.quizType === 'ESSAY') {
      this.showAlert('Đề thi tự luận chỉ được phép có 1 câu hỏi duy nhất!', 'warning');
      return;
    }

    // Only save to database if current question has valid content
    if (this.currentQuestion.questionText && this.currentQuestion.questionText.trim().length > 0) {
      // First update local array
      this.updateCurrentQuestionLocally();
      
      // Then save to database and WAIT for completion before adding new question
      this.saveCurrentQuestionToDatabaseAsync().then(() => {
        this.createAndAddNewQuestion();
      }).catch((error: any) => {
        console.error('❌ Error saving current question, but creating new question anyway:', error);
        this.createAndAddNewQuestion();
      });
    } else {
      // No current question to save, directly create new one
      this.createAndAddNewQuestion();
    }
  }

  // Helper method to create and add first question (bypasses essay restriction)
  private createAndAddFirstQuestion(): void {
    const newQuestion = this.createNewQuestion();
    this.questions.push(newQuestion);
    this.currentQuestionIndex = this.questions.length - 1;
    this.currentQuestion = { ...newQuestion };
    this.isEditing = false;
    
    // Reset selected correct answer index for first question
    this.selectedCorrectAnswerIndex = null;
    
  }

  // Helper method to create and add new question
  private createAndAddNewQuestion(): void {
    const newQuestion = this.createNewQuestion();
    this.questions.push(newQuestion);
    this.currentQuestionIndex = this.questions.length - 1;
    this.currentQuestion = { ...newQuestion };
    this.isEditing = false;
    
    // Reset selected correct answer index for new question
    this.selectedCorrectAnswerIndex = null;
    
  }

  // Switch to a specific question
  switchToQuestion(index: number): void {
    if (index >= 0 && index < this.questions.length) {
      // Only save to database if current question has valid content
      if (this.currentQuestion.questionText && this.currentQuestion.questionText.trim().length > 0) {
        // First update local array
        this.updateCurrentQuestionLocally();
        
        // Then save to database and WAIT for completion before switching
        this.saveCurrentQuestionToDatabaseAsync().then(() => {
          this.performQuestionSwitch(index);
        }).catch((error: any) => {
          console.error('❌ Error saving current question, but switching anyway:', error);
          this.performQuestionSwitch(index);
        });
      } else {
        // No current question to save, directly switch
        this.performQuestionSwitch(index);
      }
    }
  }

  // Helper method to perform the actual question switch
  private performQuestionSwitch(index: number): void {
    this.currentQuestionIndex = index;
    const selectedQuestion = this.questions[index];
    
    // If question exists in database (has questionId), reload from database
    if (selectedQuestion.questionId) {
      this.loadQuestionFromDatabase(selectedQuestion.questionId, index);
    } else {
      // New question not in database yet, use local data
      this.currentQuestion = { ...selectedQuestion };
      this.isEditing = true;
      
      // Update selected correct answer index
      this.updateSelectedCorrectAnswerIndex();
      
    }
  }

  // Load question from database and update UI
  private loadQuestionFromDatabase(questionId: number, index: number): void {
    this.examService.getQuestionById(questionId).subscribe({
      next: (response: any) => {
        // Convert backend question to frontend format
        const updatedQuestion = this.convertFromBackendQuestion(response);
        
        // Update both the array and current question
        this.questions[index] = updatedQuestion;
        this.currentQuestion = { ...updatedQuestion };
        this.isEditing = true;
        
        // Update selected correct answer index
        this.updateSelectedCorrectAnswerIndex();
        
      },
      error: (error: any) => {
        console.error(`❌ Error loading question ${questionId} from database:`, error);
        
        // Fallback to local data if database call fails
        this.currentQuestion = { ...this.questions[index] };
        this.isEditing = true;
        
        // Update selected correct answer index
        this.updateSelectedCorrectAnswerIndex();
        
        // Show warning to user
        this.showAlert('Không thể tải câu hỏi từ database. Hiển thị dữ liệu local.', 'warning');
      }
    });
  }

  // Save current question
  saveCurrentQuestion(): void {
    if (!this.isFormValid()) {
      this.showAlert('Vui lòng điền đầy đủ thông tin câu hỏi!', 'warning');
      return;
    }

    if (this.isEditing) {
      // Update existing question
      this.questions[this.currentQuestionIndex] = { ...this.currentQuestion };
      this.showAlert('Câu hỏi đã được cập nhật!', 'success');
    } else {
      // Add new question to list
      this.questions.push({ ...this.currentQuestion });
      this.currentQuestionIndex = this.questions.length - 1;
      this.isEditing = true;
      this.showAlert('Câu hỏi đã được lưu!', 'success');
    }
    
  }

  // Save current question silently (without alerts)
  private saveCurrentQuestionSilently(): void {
    if (this.isEditing) {
      // Update existing question
      this.questions[this.currentQuestionIndex] = { ...this.currentQuestion };
    } else {
      // Add new question to list
      this.questions.push({ ...this.currentQuestion });
      this.currentQuestionIndex = this.questions.length - 1;
      this.isEditing = true;
    }
  }

  // Save current question to database immediately (async version)
  private saveCurrentQuestionToDatabaseAsync(): Promise<any> {
    return new Promise((resolve, reject) => {
      // Only require question text to save (allow partial saves)
      if (!this.currentQuestion.questionText || this.currentQuestion.questionText.trim().length === 0) {
        resolve(null);
        return;
      }

      // Don't modify the local array here - it should already be updated by updateCurrentQuestionLocally()
      const questionToSave = this.currentQuestion;

      // Check if it's a new question (no questionId) or existing question that needs update
      if (!questionToSave.questionId) {
        // New question - save to database (allow partial saves)
        const questionDto = this.convertToQuestionDtoAllowPartial(questionToSave);
        
        this.examService.createQuestion(questionDto).subscribe({
          next: (response: any) => {
            // Update the question with the returned ID in both current question and array
            if (response.questionId) {
              // Update current question
              this.currentQuestion.questionId = response.questionId;
              
              // Update question in array if it exists
              if (this.currentQuestionIndex >= 0 && this.currentQuestionIndex < this.questions.length) {
                this.questions[this.currentQuestionIndex].questionId = response.questionId;
              }
              
            }
            resolve(response);
          },
          error: (error: any) => {
            console.error('❌ Error saving question to database:', error);
            reject(error);
          }
        });
      } else {
        // Existing question - update in database (allow partial saves)
        const questionDto = this.convertToQuestionDtoAllowPartial(questionToSave);
        
        this.examService.updateQuestion(questionToSave.questionId, questionDto).subscribe({
          next: (response: any) => {
            resolve(response);
          },
          error: (error: any) => {
            console.error('❌ Error updating question in database:', error);
            reject(error);
          }
        });
      }
    });
  }

  // Save current question to database immediately
  saveCurrentQuestionToDatabase(): void {
    // Only require question text to save (allow partial saves)
    if (!this.currentQuestion.questionText || this.currentQuestion.questionText.trim().length === 0) {
      return;
    }

    // Don't modify the local array here - it should already be updated by updateCurrentQuestionLocally()
    const questionToSave = this.currentQuestion;

    // Check if it's a new question (no questionId) or existing question that needs update
    if (!questionToSave.questionId) {
      // New question - save to database (allow partial saves)
      const questionDto = this.convertToQuestionDtoAllowPartial(questionToSave);
      
      this.examService.createQuestion(questionDto).subscribe({
        next: (response: any) => {
          // Update the question with the returned ID in both current question and array
          if (response.questionId) {
            // Update current question
            this.currentQuestion.questionId = response.questionId;
            
            // Update question in array if it exists
            if (this.currentQuestionIndex >= 0 && this.currentQuestionIndex < this.questions.length) {
              this.questions[this.currentQuestionIndex].questionId = response.questionId;
            }
          }
        },
        error: (error: any) => {
          console.error('❌ Error saving question to database:', error);
          // Question still saved locally even if database save fails
        }
      });
    } else {
      // Existing question - update in database (allow partial saves)
      const questionDto = this.convertToQuestionDtoAllowPartial(questionToSave);
      
      this.examService.updateQuestion(questionToSave.questionId, questionDto).subscribe({
        next: (response: any) => {
          // Question updated successfully
        },
        error: (error: any) => {
          console.error('❌ Error updating question in database:', error);
          // Question still updated locally even if database update fails
        }
      });
    }
  }

  // Check if current question has unsaved changes
  private hasUnsavedChanges(): boolean {
    if (!this.isEditing || this.currentQuestionIndex >= this.questions.length) {
      return true; // New question always has changes to save
    }

    const existingQuestion = this.questions[this.currentQuestionIndex];
    
    // Compare basic properties
    if (existingQuestion.questionText !== this.currentQuestion.questionText ||
        existingQuestion.questionType !== this.currentQuestion.questionType ||
        existingQuestion.points !== this.currentQuestion.points ||
        existingQuestion.explanation !== this.currentQuestion.explanation) {
      return true;
    }

    // Compare options for multiple choice
    if (this.currentQuestion.questionType === 'MULTIPLE_CHOICE') {
      if (JSON.stringify(existingQuestion.options) !== JSON.stringify(this.currentQuestion.options) ||
          JSON.stringify(existingQuestion.correctAnswers) !== JSON.stringify(this.currentQuestion.correctAnswers)) {
        return true;
      }
    }

    return false;
  }

  // Public method to check if there's an unsaved question
  hasUnsavedQuestion(): boolean {
    return this.currentQuestion.questionText.trim().length > 0 && this.isFormValid() && 
           (!this.isEditing || this.hasUnsavedChanges());
  }

  // Delete question
  deleteQuestion(index: number): void {
    // Ngăn xóa câu hỏi cuối cùng trong đề thi tự luận
    if (this.quizType === 'ESSAY' && this.questions.length === 1) {
      this.showAlert('Đề thi tự luận phải có ít nhất 1 câu hỏi!', 'warning');
      return;
    }

    const message = `Bạn có chắc chắn muốn xóa câu hỏi ${index + 1}?`;
    this.displayDeleteModal('Xác nhận xóa câu hỏi', message, () => {
      this.performDeleteQuestion(index);
    });
  }

  // Perform the actual delete operation
  private performDeleteQuestion(index: number): void {
    const questionToDelete = this.questions[index];
    
    // If question exists in database, delete from backend first
    if (questionToDelete.questionId) {
      this.examService.deleteQuestion(questionToDelete.questionId).subscribe({
        next: (response: any) => {
          this.removeQuestionFromList(index);
          this.showAlert('Câu hỏi đã được xóa khỏi cơ sở dữ liệu!', 'success');
        },
        error: (error: any) => {
          console.error('❌ Error deleting question from database:', error);
          // Still remove from local list even if backend delete fails
          this.removeQuestionFromList(index);
          this.showAlert('Đã xóa câu hỏi khỏi danh sách (có thể chưa xóa khỏi cơ sở dữ liệu)', 'warning');
        }
      });
    } else {
      // Question not in database yet, just remove from list
      this.removeQuestionFromList(index);
    }
  }

  // Remove question from local list
  private removeQuestionFromList(index: number): void {
    this.questions.splice(index, 1);
    
    // Adjust current index
    if (this.currentQuestionIndex >= this.questions.length) {
      this.currentQuestionIndex = Math.max(0, this.questions.length - 1);
    }
    
    if (this.questions.length > 0) {
      this.currentQuestion = { ...this.questions[this.currentQuestionIndex] };
      this.isEditing = true;
    } else {
      this.currentQuestion = this.createNewQuestion();
      this.isEditing = false;
    }
  }

  // Form validation with debouncing
  isFormValid(): boolean {
    // Quick check first to avoid unnecessary logging
    if (!this.currentQuestion.questionText || this.currentQuestion.questionText.trim().length === 0) {
      return false;
    }
    
    const basicValid = this.currentQuestion.questionText.trim().length > 0 && 
                      this.currentQuestion.points > 0;

    if (this.currentQuestion.questionType === 'MULTIPLE_CHOICE') {
      const hasOptions = this.currentQuestion.options?.some(option => option.trim().length > 0) || false;
      const hasCorrectAnswer = this.currentQuestion.correctAnswers?.some(answer => answer) || false;
      
      const finalValid = basicValid && hasOptions && hasCorrectAnswer;
      return finalValid;
    }

    return basicValid;
  }

  // Debounced validation for real-time UI updates
  private debouncedValidation(): void {
    if (this.validationTimeout) {
      clearTimeout(this.validationTimeout);
    }
    
    this.validationTimeout = setTimeout(() => {
      // Only log validation details when needed
      if (this.currentQuestion.questionText && this.currentQuestion.questionText.trim().length > 0) {
        // Validation passed, no logging needed
      }
    }, 300);
  }

  // Check if a question is complete and ready to save
  private isQuestionComplete(question: QuestionData): boolean {
    // Quick return for obviously incomplete questions to reduce noise
    if (!question.questionText || question.questionText.trim().length === 0) {
      return false;
    }
    
    const hasQuestionText = question.questionText && question.questionText.trim().length > 0;
    const hasValidPoints = question.points > 0;
    const basicValid = hasQuestionText && hasValidPoints;

    if (question.questionType === 'MULTIPLE_CHOICE') {
      const hasOptions = question.options?.some(option => option && option.trim().length > 0) || false;
      const hasCorrectAnswer = question.correctAnswers?.some(answer => answer) || false;
      const multipleChoiceValid = basicValid && hasOptions && hasCorrectAnswer;
      
      return !!multipleChoiceValid;
    }

    return !!basicValid;
  }

  // Add option for multiple choice
  addOption(): void {
    if (this.currentQuestion.options && this.currentQuestion.correctAnswers && 
        this.currentQuestion.options.length < 6) {
      this.currentQuestion.options.push('');
      this.currentQuestion.correctAnswers.push(false);
    }
  }

  // Remove option for multiple choice
  removeOption(index: number): void {
    if (this.currentQuestion.options && this.currentQuestion.correctAnswers && 
        this.currentQuestion.options.length > 2) {
      this.currentQuestion.options.splice(index, 1);
      this.currentQuestion.correctAnswers.splice(index, 1);
      
      // Update selected correct answer index if it was affected
      if (this.selectedCorrectAnswerIndex === index) {
        this.selectedCorrectAnswerIndex = null;
      } else if (this.selectedCorrectAnswerIndex !== null && this.selectedCorrectAnswerIndex > index) {
        this.selectedCorrectAnswerIndex--;
      }
    }
  }

  // Handle correct answer selection (only one allowed)
  onCorrectAnswerChange(selectedIndex: number): void {
    // Reset all correct answers to false
    if (this.currentQuestion.correctAnswers) {
      this.currentQuestion.correctAnswers.fill(false);
      // Set only the selected one to true
      this.currentQuestion.correctAnswers[selectedIndex] = true;
      this.selectedCorrectAnswerIndex = selectedIndex;
    }
    this.onQuestionContentChange();
  }

  // Update selected correct answer index based on current question
  private updateSelectedCorrectAnswerIndex(): void {
    this.selectedCorrectAnswerIndex = null;
    
    if (this.currentQuestion.correctAnswers) {
      const correctIndex = this.currentQuestion.correctAnswers.findIndex(answer => answer === true);
      if (correctIndex !== -1) {
        this.selectedCorrectAnswerIndex = correctIndex;
      }
    }
  }

  // Handle file selection for essay questions
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        this.showAlert('File size must be less than 10MB', 'error');
        return;
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        this.showAlert('Only images, PDF, and Word documents are allowed', 'error');
        return;
      }

      this.selectedFile = file;
    }
  }

  // Remove existing file from question
  removeExistingFile(): void {
    this.currentQuestion.questionFileUrl = undefined;
    this.currentQuestion.questionFileName = undefined;
    
    // Update questions array
    if (this.isEditing && this.currentQuestionIndex < this.questions.length) {
      this.questions[this.currentQuestionIndex].questionFileUrl = undefined;
      this.questions[this.currentQuestionIndex].questionFileName = undefined;
    }
  }

  // Rich text formatting functions for essay questions
  formatText(command: string): void {
    if (this.questionTextArea) {
      const textarea = this.questionTextArea.nativeElement;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = textarea.value.substring(start, end);
      
      let newText = '';
      switch (command) {
        case 'bold':
          newText = `<b>${selectedText}</b>`;
          break;
        case 'italic':
          newText = `<i>${selectedText}</i>`;
          break;
        case 'underline':
          newText = `<u>${selectedText}</u>`;
          break;
        default:
          newText = selectedText;
      }
      
      textarea.value = textarea.value.substring(0, start) + newText + textarea.value.substring(end);
      this.currentQuestion.questionText = textarea.value;
    }
  }

  // Save all questions to backend
  saveAllQuestions(): void {
    // Auto-save current question if form is valid and not already saved
    if (this.isFormValid() && (!this.isEditing || this.hasUnsavedChanges())) {
      this.saveCurrentQuestionSilently();
    }

    // Clean up empty questions before validation
    this.cleanupEmptyQuestions();

    if (this.questions.length === 0) {
      this.showAlert('Chưa có câu hỏi nào để lưu!', 'warning');
      return;
    }

    // Count incomplete questions
    const incompleteQuestions = this.questions.filter(q => !this.isQuestionComplete(q));
    if (incompleteQuestions.length > 0) {
      const message = `Có ${incompleteQuestions.length} câu hỏi chưa hoàn thành. Chỉ những câu hỏi hoàn thành mới được lưu.`;
      this.displayConfirmModal('Xác nhận lưu câu hỏi', message, () => {
        this.performSaveAllQuestions();
      });
      return;
    }

    this.performSaveAllQuestions();
  }

  // Perform the actual save operation
  private performSaveAllQuestions(): void {
    this.isSaving = true;

    // Save questions to database
    this.saveQuestionsToDatabase();
  }

  // Clean up questions with empty questionText
  private cleanupEmptyQuestions(): void {
    const originalLength = this.questions.length;
    this.questions = this.questions.filter(q => q.questionText && q.questionText.trim().length > 0);
    
    if (this.questions.length < originalLength) {
      // Adjust current index if needed
      if (this.currentQuestionIndex >= this.questions.length) {
        this.currentQuestionIndex = Math.max(0, this.questions.length - 1);
      }
      
      // Update current question if needed
      if (this.questions.length > 0 && this.currentQuestionIndex < this.questions.length) {
        this.currentQuestion = { ...this.questions[this.currentQuestionIndex] };
        this.isEditing = true;
      } else if (this.questions.length === 0) {
        this.currentQuestion = this.createNewQuestion();
        this.isEditing = false;
      }
    }
  }

  // Save questions to database
  private saveQuestionsToDatabase(): void {
    // Upload file first if selected
    if (this.selectedFile && this.currentQuestion.questionType === 'ESSAY') {
      this.uploadQuestionFile().then(() => {
        this.proceedWithSaving();
      }).catch((error) => {
        console.error('❌ File upload failed:', error);
        this.showAlert('Lưu file thất bại: ' + error.message, 'error');
        this.isSaving = false;
      });
    } else {
      this.proceedWithSaving();
    }
  }

  // Upload question file
  private uploadQuestionFile(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.selectedFile) {
        resolve();
        return;
      }

      const formData = new FormData();
      formData.append('file', this.selectedFile);

      this.examService.uploadQuestionFile(formData).subscribe({
        next: (response: any) => {
          // Update current question with file info
          this.currentQuestion.questionFileUrl = response.fileUrl;
          this.currentQuestion.questionFileName = response.fileName;
          
          // Update questions array
          if (this.isEditing && this.currentQuestionIndex < this.questions.length) {
            this.questions[this.currentQuestionIndex].questionFileUrl = response.fileUrl;
            this.questions[this.currentQuestionIndex].questionFileName = response.fileName;
          }
          
          this.selectedFile = null; // Clear selected file
          resolve();
        },
        error: (error: any) => {
          console.error('❌ Question file upload failed:', error);
          reject(new Error(error.error?.message || 'File upload failed'));
        }
      });
    });
  }

  // Proceed with saving questions after file upload
  private proceedWithSaving(): void {
    // Filter out questions with valid content only - enhanced filtering
    const questionsToSave = this.questions.filter(q => {
      // Skip questions with empty questionText immediately
      if (!q.questionText || q.questionText.trim().length === 0) {
        return false;
      }
      
      const isNew = !q.questionId;
      const hasValidText = q.questionText && q.questionText.trim().length > 0;
      const isComplete = this.isQuestionComplete(q);
      
      return isNew && hasValidText && isComplete;
    });
    
    const questionsToUpdate = this.questions.filter(q => {
      // Skip questions with empty questionText immediately
      if (!q.questionText || q.questionText.trim().length === 0) {
        return false;
      }
      
      const hasId = q.questionId && q.questionId > 0;
      const hasChanged = this.hasQuestionChanged(q);
      const hasValidText = q.questionText && q.questionText.trim().length > 0;
      const isComplete = this.isQuestionComplete(q);
      
      return hasId && hasChanged && hasValidText && isComplete;
    });
    
    let savedCount = 0;
    let updatedCount = 0;
    let totalToSave = questionsToSave.length;
    let totalToUpdate = questionsToUpdate.length;
    let totalOperations = totalToSave + totalToUpdate;

    if (totalOperations === 0) {
      this.isSaving = false;
      this.showAlert(`Tất cả câu hỏi đã được lưu!`, 'info');
      return;
    }

    // Save new questions
    questionsToSave.forEach(question => {
      // Final safety check before sending to API
      if (!question.questionText || question.questionText.trim().length === 0) {
        savedCount++;
        this.checkOperationComplete(savedCount + updatedCount, totalOperations);
        return;
      }
      
      const questionDto = this.convertToQuestionDto(question);
      
      this.examService.createQuestion(questionDto).subscribe({
        next: (response: any) => {
          savedCount++;
          
          // Update the question with the returned ID
          const index = this.questions.findIndex(q => q.id === question.id);
          if (index >= 0 && response.questionId) {
            this.questions[index].questionId = response.questionId;
          }
          
          this.checkOperationComplete(savedCount + updatedCount, totalOperations);
        },
        error: (error: any) => {
          savedCount++;
          console.error('❌ Error saving NEW question:', error);
          console.error('Error details:', error.error);
          console.error('Status:', error.status);
          console.error('Status Text:', error.statusText);
          console.error('Full error object:', JSON.stringify(error, null, 2));
          this.checkOperationComplete(savedCount + updatedCount, totalOperations);
        }
      });
    });

    // Update existing questions
    questionsToUpdate.forEach(question => {
      // Final safety check before sending to API
      if (!question.questionText || question.questionText.trim().length === 0) {
        updatedCount++;
        this.checkOperationComplete(savedCount + updatedCount, totalOperations);
        return;
      }
      
      const questionDto = this.convertToQuestionDto(question);
      
      this.examService.updateQuestion(question.questionId!, questionDto).subscribe({
        next: (response: any) => {
          updatedCount++;
          this.checkOperationComplete(savedCount + updatedCount, totalOperations);
        },
        error: (error: any) => {
          updatedCount++;
          console.error('❌ Error updating question:', error);
          this.checkOperationComplete(savedCount + updatedCount, totalOperations);
        }
      });
    });
  }

  // Check if all operations are complete
  private checkOperationComplete(completedCount: number, totalOperations: number): void {
    if (completedCount === totalOperations) {
      this.isSaving = false;
      this.showAlert(`Đã lưu thành công tất cả câu hỏi!`, 'success');
      this.navigateBackToQuiz();
    }
  }

  // Check if a question has changed (for update detection)
  private hasQuestionChanged(question: QuestionData): boolean {
    // For now, assume questions with questionId might need updates
    // In a real app, you'd track original values to compare
    return true; // Simplified - always update existing questions
  }

  // Convert QuestionData to backend DTO format
  private convertToQuestionDto(question: QuestionData): any {
    const dto: any = {
      quizId: question.quizId,
      questionText: question.questionText,
      type: question.questionType,
      points: question.points,
      questionFileUrl: question.questionFileUrl,
      questionFileName: question.questionFileName
    };

    // Nếu là trắc nghiệm, thêm answers
    if (question.questionType === 'MULTIPLE_CHOICE' && question.options && question.correctAnswers) {
      dto.answers = [];
      for (let i = 0; i < question.options.length; i++) {
        if (question.options[i] && question.options[i].trim().length > 0) {
          dto.answers.push({
            answerText: question.options[i],
            isCorrect: question.correctAnswers[i] || false,
            orderNumber: i + 1
          });
        }
      }
    }

    return dto;
  }

  // Convert QuestionData to backend DTO format - allow partial saves
  private convertToQuestionDtoAllowPartial(question: QuestionData): any {
    const dto: any = {
      quizId: question.quizId,
      questionText: question.questionText || '',
      type: question.questionType,
      points: question.points || 1, // Default to 1 point if not set
      questionFileUrl: question.questionFileUrl,
      questionFileName: question.questionFileName
    };

    // Nếu là trắc nghiệm, thêm answers nếu có
    if (question.questionType === 'MULTIPLE_CHOICE') {
      dto.answers = [];
      if (question.options && question.correctAnswers) {
        for (let i = 0; i < question.options.length; i++) {
          // Allow empty options in partial saves
          dto.answers.push({
            answerText: question.options[i] || '',
            isCorrect: question.correctAnswers[i] || false,
            orderNumber: i + 1
          });
        }
      } else {
        // Create default empty answers if none exist
        for (let i = 0; i < 4; i++) {
          dto.answers.push({
            answerText: '',
            isCorrect: false,
            orderNumber: i + 1
          });
        }
      }
    }

    return dto;
  }

  // Cancel and go back
  cancelQuestions(): void {
    if (this.questions.length > 0) {
      if (confirm(`Bạn có ${this.questions.length} câu hỏi chưa lưu. Bạn có chắc chắn muốn hủy?`)) {
        this.navigateBackToQuiz();
      }
    } else {
      this.navigateBackToQuiz();
    }
  }

  // Navigate back to quiz/exam page
  private navigateBackToQuiz(): void {
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

  // Helper method to check if current user can manage content (instructor/admin)
  canManageContent(): boolean {
    return this.sessionService.isInstructor() || this.sessionService.isAdmin();
  }

  // TrackBy function for ngFor performance optimization
  trackByIndex(index: number, item: any): number {
    return index;
  }

  // Navigation methods
  navigateToHome(): void { this.currentPage = 'Home'; }
  navigateToDiscussion(): void { this.currentPage = 'Discussion'; }
  navigateToGrades(): void { this.currentPage = 'Grades'; }
  
  navigateToModules(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (this.courseId && this.courseInfo) {
      this.router.navigate(['/module'], {
        queryParams: {
          courseId: this.courseId,
          courseName: encodeURIComponent(this.courseInfo.title),
          page: 'Modules'
        }
      });
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
      this.router.navigate(['/exam']);
    }
  }

  // Profile methods
  onProfileUpdate(): void { /* Profile update requested */ }
  
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
    this.isMenuHidden = this.leftMenuHidden;
  }

  toggleProfileDropdown(event?: Event): void {
    if (event) event.stopPropagation();
    this.showProfileDropdown = !this.showProfileDropdown;
    this.showDropdown = this.showProfileDropdown;
  }

  ngAfterViewInit(): void {
    // Initialize any view-related setup
    // Add event listeners for form changes to auto-save current question
    this.setupFormAutoSave();
  }

  // Setup auto-save for form changes
  private setupFormAutoSave(): void {
    // Auto-save disabled - only save on explicit actions (+ button or switch questions)
  }

  // Update current question locally only (no database save)
  private updateCurrentQuestionLocally(): void {
    if (this.currentQuestion.questionText && this.currentQuestion.questionText.trim().length > 0) {
      if (this.isEditing && this.currentQuestionIndex >= 0 && this.currentQuestionIndex < this.questions.length) {
        // Update existing question in the array locally only
        this.questions[this.currentQuestionIndex] = { ...this.currentQuestion };
      } else {
        // This case should be handled by the calling function (addNewQuestion)
      }
    }
  }

  // Method to trigger when form content changes (called from template)
  onQuestionContentChange(): void {
    // Only validation, no auto-save
    this.debouncedValidation();
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
}
