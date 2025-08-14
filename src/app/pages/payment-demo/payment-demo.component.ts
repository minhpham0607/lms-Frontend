import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaymentModalComponent } from '../payment-modal/payment-modal.component';
import { PaymentResponse } from '../../services/payment.service';
import { Course } from '../../models/course.model';

@Component({
  selector: 'app-payment-demo',
  standalone: true,
  imports: [CommonModule, PaymentModalComponent],
  template: `
    <div class="container mt-4">
      <h2>Demo Payment Modal</h2>
      
      <div class="row mt-4">
        <div class="col-md-6">
          <div class="card">
            <div class="card-body">
              <h5 class="card-title">{{ demoSource.title }}</h5>
              <p class="card-text">{{ demoSource.description }}</p>
              <p class="card-text">
                <strong>Giá: {{ formatPrice(demoSource.price) }}</strong>
              </p>
              <button 
                class="btn btn-primary" 
                (click)="showPaymentModal()"
                [disabled]="isPaymentModalVisible"
              >
                <i class="fas fa-credit-card me-2"></i>
                Thanh toán ngay
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Debug Info -->
      <div class="mt-4" *ngIf="lastPaymentResponse">
        <h5>Last Payment Response:</h5>
        <pre>{{ lastPaymentResponse | json }}</pre>
      </div>
    </div>

    <!-- Payment Modal -->
    <app-payment-modal
      [course]="demoSource"
      [isVisible]="isPaymentModalVisible"
      (closeModal)="hidePaymentModal()"
      (paymentSuccess)="onPaymentSuccess($event)"
    ></app-payment-modal>
  `,
  styles: [`
    .card {
      max-width: 400px;
    }
    pre {
      background: #f8f9fa;
      padding: 1rem;
      border-radius: 0.25rem;
      font-size: 0.875rem;
    }
  `]
})
export class PaymentDemoComponent {
  isPaymentModalVisible = false;
  lastPaymentResponse: PaymentResponse | null = null;

  demoSource: Course = {
    courseId: 999,
    title: 'Khóa học lập trình Angular',
    description: 'Học Angular từ cơ bản đến nâng cao với các dự án thực tế',
    price: 1999000, // 1,999,000 VND
    instructorName: 'Nguyễn Văn A',
    level: 'Trung bình',
    duration: 120
  };

  showPaymentModal() {
    this.isPaymentModalVisible = true;
  }

  hidePaymentModal() {
    this.isPaymentModalVisible = false;
  }

  onPaymentSuccess(response: PaymentResponse) {
    this.lastPaymentResponse = response;
    console.log('Payment success:', response);
    alert('Thanh toán thành công! Kiểm tra console để xem chi tiết.');
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  }
}
