import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CourseReviewService, CourseReview } from '../../services/course-review.service';

@Component({
  selector: 'app-course-reviews-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="isVisible" class="modal-overlay" (click)="onClose()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <!-- Modal Header -->
        <div class="modal-header">
          <h3 class="modal-title">
            <i class="fas fa-star me-2"></i>
            Đánh giá khóa học: {{ courseName }}
          </h3>
          <button type="button" class="btn-close" (click)="onClose()">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <!-- Modal Body -->
        <div class="modal-body">
          <!-- Course Rating Summary -->
          <div *ngIf="reviews.length > 0" class="rating-summary mb-4">
            <div class="overall-rating">
              <div class="rating-score">
                <span class="score">{{ averageRating.toFixed(1) }}</span>
                <div class="stars">
                  <i *ngFor="let star of getStarArray(averageRating)" 
                     [class]="star ? 'fas fa-star text-warning' : 'far fa-star text-muted'"></i>
                </div>
              </div>
              <div class="rating-info">
                <span class="total-reviews">{{ reviews.length }} đánh giá</span>
                <div class="rating-breakdown">
                  <div *ngFor="let rating of ratingBreakdown" class="rating-bar">
                    <span class="rating-label">{{ rating.stars }} sao</span>
                    <div class="progress">
                      <div class="progress-bar" [style.width.%]="rating.percentage"></div>
                    </div>
                    <span class="rating-count">{{ rating.count }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- No Reviews State -->
          <div *ngIf="reviews.length === 0 && !loading" class="empty-reviews">
            <i class="fas fa-star-o empty-icon"></i>
            <h4>Chưa có đánh giá nào</h4>
            <p>Khóa học này chưa có đánh giá từ học viên.</p>
          </div>

          <!-- Loading State -->
          <div *ngIf="loading" class="loading-state">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Đang tải...</span>
            </div>
            <p>Đang tải đánh giá...</p>
          </div>

          <!-- Reviews List -->
          <div *ngIf="reviews.length > 0" class="reviews-list">
            <h5 class="reviews-title">Đánh giá từ học viên</h5>
            <div *ngFor="let review of paginatedReviews" class="review-item">
              <div class="review-header">
                <div class="reviewer-info">
                  <img 
                    [src]="getAvatarUrl(review.avatarUrl)" 
                    [alt]="review.fullName || 'Ẩn danh'"
                    class="reviewer-avatar"
                  >
                  <div class="reviewer-details">
                    <span class="reviewer-name">{{ review.fullName || 'Ẩn danh' }}</span>
                    <div class="review-stars">
                      <i *ngFor="let star of getStarArray(review.rating)" 
                         [class]="star ? 'fas fa-star text-warning' : 'far fa-star text-muted'"></i>
                    </div>
                  </div>
                </div>
                <span class="review-date">{{ formatDate(review.createdAt || '') }}</span>
              </div>
              
              <div class="review-content">
                <p>{{ review.comment }}</p>
              </div>
            </div>

            <!-- Pagination -->
            <div *ngIf="totalPages > 1" class="pagination-controls">
              <button 
                class="btn btn-sm btn-outline-primary" 
                (click)="previousPage()" 
                [disabled]="currentPage === 1"
              >
                <i class="fas fa-chevron-left"></i>
                Trước
              </button>
              
              <span class="page-info">
                Trang {{ currentPage }} / {{ totalPages }}
              </span>
              
              <button 
                class="btn btn-sm btn-outline-primary" 
                (click)="nextPage()" 
                [disabled]="currentPage === totalPages"
              >
                Sau
                <i class="fas fa-chevron-right"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="modal-footer">
          <button 
            *ngIf="canWriteReview" 
            type="button" 
            class="btn btn-primary me-2" 
            (click)="navigateToWriteReview()"
          >
            <i class="fas fa-edit me-2"></i>
            Viết đánh giá
          </button>
          <button type="button" class="btn btn-secondary" (click)="onClose()">
            Đóng
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1050;
    }

    .modal-content {
      background: white;
      border-radius: 10px;
      max-width: 800px;
      width: 90%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.5rem;
      border-bottom: 1px solid #dee2e6;
    }

    .modal-title {
      margin: 0;
      color: #333;
    }

    .btn-close {
      background: none;
      border: none;
      font-size: 1.2rem;
      cursor: pointer;
      color: #666;
    }

    .modal-body {
      padding: 1.5rem;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      padding: 1rem 1.5rem;
      border-top: 1px solid #dee2e6;
    }

    .rating-summary {
      background: #f8f9fa;
      padding: 1.5rem;
      border-radius: 8px;
    }

    .overall-rating {
      display: flex;
      gap: 2rem;
      align-items: flex-start;
    }

    .rating-score {
      text-align: center;
    }

    .score {
      font-size: 3rem;
      font-weight: bold;
      color: #ffc107;
      display: block;
    }

    .stars {
      display: flex;
      gap: 2px;
      justify-content: center;
      margin: 0.5rem 0;
    }

    .stars i {
      font-size: 1.2rem;
    }

    .rating-info {
      flex: 1;
    }

    .total-reviews {
      font-size: 1.1rem;
      font-weight: 600;
      color: #666;
    }

    .rating-breakdown {
      margin-top: 1rem;
    }

    .rating-bar {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 0.5rem;
    }

    .rating-label {
      width: 50px;
      font-size: 0.9rem;
    }

    .progress {
      flex: 1;
      height: 8px;
      background: #e9ecef;
      border-radius: 4px;
    }

    .progress-bar {
      height: 100%;
      background: #ffc107;
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    .rating-count {
      width: 30px;
      text-align: right;
      font-size: 0.9rem;
      color: #666;
    }

    .empty-reviews {
      text-align: center;
      padding: 3rem 1rem;
      color: #666;
    }

    .empty-icon {
      font-size: 4rem;
      color: #ddd;
      margin-bottom: 1rem;
    }

    .loading-state {
      text-align: center;
      padding: 2rem;
    }

    .reviews-list {
      margin-top: 2rem;
    }

    .reviews-title {
      margin-bottom: 1.5rem;
      color: #333;
    }

    .review-item {
      border: 1px solid #e9ecef;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1rem;
    }

    .review-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1rem;
    }

    .reviewer-info {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .reviewer-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      object-fit: cover;
    }

    .reviewer-name {
      font-weight: 600;
      color: #333;
      display: block;
      margin-bottom: 0.25rem;
    }

    .review-stars {
      display: flex;
      gap: 2px;
    }

    .review-stars i {
      font-size: 0.9rem;
    }

    .review-date {
      font-size: 0.9rem;
      color: #666;
    }

    .review-content p {
      margin: 0;
      line-height: 1.6;
      color: #555;
    }

    .pagination-controls {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 1rem;
      margin-top: 2rem;
    }

    .page-info {
      font-weight: 600;
      color: #666;
    }

    .btn {
      padding: 0.5rem 1rem;
      border: 1px solid #007bff;
      border-radius: 4px;
      background: transparent;
      color: #007bff;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .btn:hover:not(:disabled) {
      background: #007bff;
      color: white;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: #6c757d;
      border-color: #6c757d;
      color: white;
    }

    .btn-secondary:hover {
      background: #5a6268;
      border-color: #545b62;
    }

    .btn-primary {
      background: #007bff;
      border-color: #007bff;
      color: white;
    }

    .btn-primary:hover {
      background: #0056b3;
      border-color: #004085;
    }

    .text-warning {
      color: #ffc107 !important;
    }

    .text-muted {
      color: #6c757d !important;
    }

    @media (max-width: 768px) {
      .modal-content {
        width: 95%;
        margin: 1rem;
      }

      .overall-rating {
        flex-direction: column;
        gap: 1rem;
        text-align: center;
      }

      .review-header {
        flex-direction: column;
        gap: 0.5rem;
        align-items: flex-start;
      }
    }
  `]
})
export class CourseReviewsModalComponent implements OnInit, OnChanges {
  @Input() isVisible = false;
  @Input() courseId: number | null = null;
  @Input() courseName = '';
  @Input() canWriteReview = false; // Whether user can write review (enrolled students)
  @Output() closeModal = new EventEmitter<void>();

  reviews: CourseReview[] = [];
  loading = false;
  
  // Pagination
  currentPage = 1;
  pageSize = 5;
  
  // Computed properties
  get averageRating(): number {
    if (this.reviews.length === 0) return 0;
    return this.reviews.reduce((sum, review) => sum + review.rating, 0) / this.reviews.length;
  }
  
  get totalPages(): number {
    return Math.ceil(this.reviews.length / this.pageSize);
  }
  
  get paginatedReviews(): CourseReview[] {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    return this.reviews.slice(startIndex, startIndex + this.pageSize);
  }
  
  get ratingBreakdown(): { stars: number; count: number; percentage: number }[] {
    const breakdown = [5, 4, 3, 2, 1].map(stars => {
      const count = this.reviews.filter(r => r.rating === stars).length;
      const percentage = this.reviews.length > 0 ? (count / this.reviews.length) * 100 : 0;
      return { stars, count, percentage };
    });
    return breakdown;
  }

  constructor(
    private courseReviewService: CourseReviewService,
    private router: Router
  ) {}

  ngOnInit() {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['isVisible'] && this.isVisible && this.courseId) {
      this.loadReviews();
    }
  }

  async loadReviews() {
    if (!this.courseId) return;
    
    this.loading = true;
    try {
      this.reviews = await this.courseReviewService.getReviewsByCourse(this.courseId).toPromise() || [];
      this.currentPage = 1; // Reset to first page
    } catch (error) {
      console.error('Error loading reviews:', error);
      this.reviews = [];
    } finally {
      this.loading = false;
    }
  }

  getStarArray(rating: number): boolean[] {
    const stars: boolean[] = [];
    const fullStars = Math.floor(rating);
    
    for (let i = 0; i < 5; i++) {
      stars.push(i < fullStars);
    }
    return stars;
  }

  getAvatarUrl(avatarUrl: string | undefined | null): string {
    if (!avatarUrl) {
      return '/assets/default-avatar.png';
    }
    
    if (avatarUrl.startsWith('http')) {
      return avatarUrl;
    }
    
    return `http://localhost:8080/images/avatars/${avatarUrl}`;
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  navigateToWriteReview() {
    this.onClose();
    this.router.navigate(['/course-review'], {
      queryParams: {
        courseId: this.courseId,
        courseName: this.courseName,
        mode: 'write'
      }
    });
  }

  onClose() {
    this.closeModal.emit();
  }
}
