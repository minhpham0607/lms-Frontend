import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CourseReview, CourseReviewService, ReviewRequest, CourseCompletionDTO } from '../../../services/course-review.service';
import { SessionService } from '../../../services/session.service';
import { ImageUrlService } from '../../../services/image-url.service';
import { SidebarWrapperComponent } from '../../../components/sidebar-wrapper/sidebar-wrapper.component';
import { ProfileComponent } from '../../../components/profile/profile.component';
import { NotificationComponent } from '../../../components/notification/notification.component';
import { UserService } from '../../../services/user.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-course-review',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarWrapperComponent, ProfileComponent, NotificationComponent],
  templateUrl: './course-review.component.html',
  styleUrls: ['./course-review.component.scss']
})
export class CourseReviewComponent implements OnInit {
  eligibleCourses: CourseReview[] = [];
  selectedCourse: CourseReview | null = null;
  courseReviews: CourseReview[] = [];
  myReview: CourseReview | null = null;
  userRole: string = '';
  
  // Profile component properties
  username: string = '';
  avatarUrl: string = '';
  
  // Course completion data
  courseCompletions: Map<number, CourseCompletionDTO> = new Map();
  
  // Review form data
  reviewForm: ReviewRequest = {
    courseId: 0,
    rating: 5,
    comment: ''
  };
  
  // UI states
  showReviewForm: boolean = false;
  isEditing: boolean = false;
  loading: boolean = false;
  
  // Minimum completion percentage required for review
  readonly MIN_COMPLETION_PERCENTAGE = 80;

  constructor(
    private courseReviewService: CourseReviewService,
    public sessionService: SessionService,
    private userService: UserService,
    private imageUrlService: ImageUrlService
  ) {}

  ngOnInit(): void {
    this.initializeUserProfile();
    this.userRole = this.sessionService.getUserRole() || '';
    this.loadData();
  }

  // Initialize user profile data from session
  private initializeUserProfile() {
    const userInfo = this.userService.getCurrentUserInfo();
    this.username = userInfo.username;
    this.userRole = userInfo.role; // Giữ nguyên role gốc để sử dụng trong logic
    this.avatarUrl = userInfo.avatarUrl; // ✅ Sử dụng avatar mặc định từ service
  }

  // Format role để hiển thị (chữ cái đầu viết hoa)
  getDisplayRole(role: string): string {
    const cleanRole = role.replace('ROLE_', '').toLowerCase();
    return cleanRole.charAt(0).toUpperCase() + cleanRole.slice(1);
  }

  // Profile component event handlers
  onProfileUpdate() {
  }

  onLogout() {
    this.sessionService.logout();
  }

  loadData(): void {
    this.loading = true;
    
    if (this.sessionService.isStudent()) {
      this.loadEligibleCourses();
    } else if (this.sessionService.isInstructor()) {
      this.loadInstructorReviews();
    } else if (this.sessionService.isAdmin()) {
      this.loadAllReviews();
    }
  }

  loadEligibleCourses(): void {
    this.courseReviewService.getEligibleCourses().subscribe({
      next: (courses) => {
        // Load completion data for each course
        const completionRequests = courses.map(course => 
          this.courseReviewService.getCourseCompletion(course.courseId)
        );

        if (completionRequests.length > 0) {
          forkJoin(completionRequests).subscribe({
            next: (completions) => {
              // Filter courses based on completion percentage
              const eligibleCourses: CourseReview[] = [];
              
              courses.forEach((course, index) => {
                const completion = completions[index];
                this.courseCompletions.set(course.courseId, completion);
                
                // Only show courses with >= 80% completion
                if (completion.completionPercentage >= this.MIN_COMPLETION_PERCENTAGE) {
                  course.completionPercentage = completion.completionPercentage;
                  eligibleCourses.push(course);
                }
              });
              
              this.eligibleCourses = eligibleCourses;
              this.loading = false;
            },
            error: (error) => {
              // Fallback: show all courses without completion check
              this.eligibleCourses = courses;
              this.loading = false;
            }
          });
        } else {
          this.eligibleCourses = [];
          this.loading = false;
        }
      },
      error: (error) => {
        this.loading = false;
      }
    });
  }

  loadInstructorReviews(): void {
    this.courseReviewService.getInstructorCourseReviews().subscribe({
      next: (reviews) => {
        this.courseReviews = reviews;
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
      }
    });
  }

  loadAllReviews(): void {
    this.courseReviewService.getAllReviews().subscribe({
      next: (reviews) => {
        this.courseReviews = reviews;
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
      }
    });
  }

  selectCourse(course: CourseReview): void {
    this.selectedCourse = course;
    this.loadCourseReviews(course.courseId);
    this.loadMyReview(course.courseId);
  }

  loadCourseReviews(courseId: number): void {
    this.courseReviewService.getReviewsByCourse(courseId).subscribe({
      next: (reviews) => {
        this.courseReviews = reviews;
      },
      error: (error) => {
      }
    });
  }

  loadMyReview(courseId: number): void {
    if (this.sessionService.isStudent()) {
      this.courseReviewService.getMyReview(courseId).subscribe({
        next: (review) => {
          this.myReview = review;
        },
        error: (error) => {
          // User hasn't reviewed yet
          this.myReview = null;
        }
      });
    }
  }

  openReviewForm(course: CourseReview): void {
    // Check completion percentage before allowing review
    if (!this.canReviewCourse(course)) {
      const completion = this.courseCompletions.get(course.courseId);
      const percentage = completion?.completionPercentage || 0;
      alert(`Bạn cần hoàn thành ít nhất ${this.MIN_COMPLETION_PERCENTAGE}% khóa học để có thể đánh giá. Tiến độ hiện tại: ${percentage.toFixed(1)}%`);
      return;
    }

    this.reviewForm.courseId = course.courseId;
    
    if (this.myReview) {
      // Editing existing review
      this.reviewForm.rating = this.myReview.rating;
      this.reviewForm.comment = this.myReview.comment || '';
      this.isEditing = true;
    } else {
      // Creating new review
      this.reviewForm.rating = 5;
      this.reviewForm.comment = '';
      this.isEditing = false;
    }
    
    this.showReviewForm = true;
  }

  // Check if user can review the course based on completion percentage
  canReviewCourse(course: CourseReview): boolean {
    const completion = this.courseCompletions.get(course.courseId);
    return (completion?.completionPercentage || 0) >= this.MIN_COMPLETION_PERCENTAGE;
  }

  // Get completion percentage for display
  getCompletionPercentage(courseId: number): number {
    const completion = this.courseCompletions.get(courseId);
    return completion?.completionPercentage || 0;
  }

  // Get completion details for display
  getCompletionDetails(courseId: number): CourseCompletionDTO | null {
    return this.courseCompletions.get(courseId) || null;
  }

  submitReview(): void {
    if (this.reviewForm.rating < 1 || this.reviewForm.rating > 5) {
      alert('Rating must be between 1 and 5');
      return;
    }

    this.loading = true;

    this.courseReviewService.createOrUpdateReview(this.reviewForm).subscribe({
      next: (review) => {
        this.myReview = review;
        this.showReviewForm = false;
        this.loadCourseReviews(this.reviewForm.courseId);
        this.loadEligibleCourses(); // Refresh eligible courses
        this.loading = false;
        alert(this.isEditing ? 'Review updated successfully!' : 'Review submitted successfully!');
      },
      error: (error) => {
        this.loading = false;
        alert('Error submitting review. Please try again.');
      }
    });
  }

  cancelReview(): void {
    this.showReviewForm = false;
    this.reviewForm = { courseId: 0, rating: 5, comment: '' };
  }

  deleteReview(reviewId: number): void {
    if (confirm('Are you sure you want to delete this review?')) {
      this.courseReviewService.deleteReview(reviewId).subscribe({
        next: () => {
          this.loadAllReviews();
          alert('Review deleted successfully!');
        },
        error: (error) => {
          alert('Error deleting review. Please try again.');
        }
      });
    }
  }

  getStarArray(rating: number): number[] {
    return Array(5).fill(0).map((_, i) => i + 1);
  }

  isStarFilled(star: number, rating: number): boolean {
    return star <= rating;
  }

  setRating(rating: number): void {
    this.reviewForm.rating = rating;
  }

  // Helper method to get full image URL
  getImageUrl(imageUrl: string | undefined): string {
    if (!imageUrl) {
      return 'assets/pictures/default-course.png';
    }
    
    return this.imageUrlService.getImageUrl(imageUrl);
  }

  // Helper method to get full avatar URL
  getAvatarUrl(avatarUrl: string | undefined): string {
    if (!avatarUrl) {
      return 'assets/pictures/avt.png';
    }
    
    return this.imageUrlService.getAvatarUrl(avatarUrl);
  }
}