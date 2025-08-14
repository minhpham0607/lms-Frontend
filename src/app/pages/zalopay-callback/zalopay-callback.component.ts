import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { PaymentService } from '../../services/payment.service';

@Component({
  selector: 'app-zalopay-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container mt-5">
      <div class="row justify-content-center">
        <div class="col-md-8">
          <div class="card">
            <div class="card-body text-center">
              <div *ngIf="isLoading" class="mb-4">
                <div class="spinner-border text-primary" role="status">
                  <span class="visually-hidden">Đang xử lý...</span>
                </div>
                <h4 class="mt-3">Đang xử lý thanh toán ZaloPay...</h4>
                <p class="text-muted">Vui lòng chờ trong giây lát</p>
              </div>

              <div *ngIf="!isLoading && paymentSuccess" class="text-success mb-4">
                <i class="fas fa-check-circle fa-4x mb-3"></i>
                <h3>Thanh toán thành công!</h3>
                <p>Cảm ơn bạn đã thanh toán qua ZaloPay. Bạn có thể bắt đầu học khóa học ngay bây giờ.</p>
                
                <div class="payment-details mt-4">
                  <div class="row">
                    <div class="col-md-6">
                      <strong>Mã giao dịch:</strong><br>
                      <code>{{ transactionId }}</code>
                    </div>
                    <div class="col-md-6">
                      <strong>Số tiền:</strong><br>
                      <span class="text-success">{{ formatCurrency(amount) }}</span>
                    </div>
                  </div>
                </div>

                <div class="action-buttons mt-4">
                  <button 
                    class="btn btn-primary me-3" 
                    (click)="goToCourse()"
                    *ngIf="courseId"
                  >
                    <i class="fas fa-play me-2"></i>
                    Bắt đầu học
                  </button>
                  <button 
                    class="btn btn-outline-secondary" 
                    (click)="goToHome()"
                  >
                    <i class="fas fa-home me-2"></i>
                    Về trang chủ
                  </button>
                </div>
              </div>

              <div *ngIf="!isLoading && !paymentSuccess" class="text-danger mb-4">
                <i class="fas fa-times-circle fa-4x mb-3"></i>
                <h3>Thanh toán không thành công</h3>
                <p>{{ errorMessage || 'Có lỗi xảy ra trong quá trình thanh toán.' }}</p>
                
                <div class="action-buttons mt-4">
                  <button 
                    class="btn btn-primary me-3" 
                    (click)="retryPayment()"
                  >
                    <i class="fas fa-redo me-2"></i>
                    Thử lại
                  </button>
                  <button 
                    class="btn btn-outline-secondary" 
                    (click)="goToHome()"
                  >
                    <i class="fas fa-home me-2"></i>
                    Về trang chủ
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .card {
      border: none;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
      border-radius: 15px;
    }

    .payment-details {
      background: #f8f9fa;
      border-radius: 10px;
      padding: 20px;
      border: 1px solid #e9ecef;
    }

    .action-buttons {
      .btn {
        min-width: 150px;
      }
    }

    code {
      background: #e9ecef;
      padding: 5px 10px;
      border-radius: 5px;
      font-size: 0.9rem;
    }

    .fa-check-circle {
      color: #28a745;
    }

    .fa-times-circle {
      color: #dc3545;
    }

    .spinner-border {
      width: 3rem;
      height: 3rem;
    }
  `]
})
export class ZaloPayCallbackComponent implements OnInit {
  isLoading = true;
  paymentSuccess = false;
  errorMessage = '';
  transactionId = '';
  amount = 0;
  courseId: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private paymentService: PaymentService
  ) {}

  ngOnInit() {
    this.processCallback();
  }

  private async processCallback() {
    try {
      // Lấy query parameters từ ZaloPay callback
      const queryParams = window.location.search;
      
      if (!queryParams) {
        this.handlePaymentError('Không có thông tin thanh toán');
        return;
      }

      // Gọi API để xác nhận thanh toán với ZaloPay
      const response = await this.paymentService.confirmZaloPayPayment(queryParams).toPromise();
      
      if (response && response.success) {
        this.paymentSuccess = true;
        this.transactionId = response.transactionId || '';
        this.amount = response.coursePrice || 0;
        
        // Lấy courseId từ response hoặc từ query params
        if (response.courseId) {
          this.courseId = response.courseId;
        }
      } else {
        this.handlePaymentError(response?.message || 'Thanh toán không thành công');
      }
    } catch (error: any) {
      console.error('ZaloPay Callback Error:', error);
      this.handlePaymentError(error.error?.message || error.message || 'Có lỗi xảy ra khi xử lý thanh toán');
    } finally {
      this.isLoading = false;
    }
  }

  private handlePaymentError(message: string) {
    this.paymentSuccess = false;
    this.errorMessage = message;
    this.isLoading = false;
  }

  goToCourse() {
    if (this.courseId) {
      this.router.navigate(['/course-home'], { queryParams: { courseId: this.courseId } });
    } else {
      this.goToHome();
    }
  }

  goToHome() {
    this.router.navigate(['/']);
  }

  retryPayment() {
    this.router.navigate(['/courses']);
  }

  formatCurrency(amount: number): string {
    return this.paymentService.formatCurrency(amount);
  }
}
