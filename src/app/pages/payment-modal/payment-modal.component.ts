import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaymentService, PaymentRequest, PaymentResponse, VNPayRequest, ZaloPayRequest } from '../../services/payment.service';
import { Course } from '../../models/course.model';

@Component({
  selector: 'app-payment-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payment-modal.component.html',
  styleUrls: ['./payment-modal.component.scss']
})
export class PaymentModalComponent implements OnInit {
  @Input() course: Course | null = null;
  @Input() isVisible = false;
  @Output() closeModal = new EventEmitter<void>();
  @Output() paymentSuccess = new EventEmitter<PaymentResponse>();

  paymentMethods = [
    { value: 'vnpay', label: 'VNPay', icon: 'fas fa-credit-card' },
    { value: 'momo', label: 'MoMo', icon: 'fas fa-mobile-alt' },
    { value: 'zalopay', label: 'ZaloPay', icon: 'fas fa-wallet' },
    { value: 'credit_card', label: 'Thẻ tín dụng', icon: 'fas fa-credit-card' }
  ];

  selectedPaymentMethod = 'vnpay';
  isLoading = false;
  errorMessage = '';

  constructor(private paymentService: PaymentService) {}

  ngOnInit() {}

  onClose() {
    this.closeModal.emit();
  }

  async onPayment() {
    if (!this.course) return;

    this.isLoading = true;
    this.errorMessage = '';

    try {
      if (this.selectedPaymentMethod === 'vnpay') {
        // Gọi API VNPay riêng với thông tin chi tiết
        const vnpayRequest: VNPayRequest = {
          courseId: this.course.courseId,
          amount: this.course.price,
          orderInfo: `Thanh toan khoa hoc: ${this.course.title}`
        };

        const response = await this.paymentService.createVNPayPayment(vnpayRequest).toPromise();
        
        if (response && response.success) {
          // Mở URL VNPay trong tab mới
          if (response.paymentUrl) {
            window.open(response.paymentUrl, '_blank');
          }
          
          // Emit success event
          this.paymentSuccess.emit(response);
          
          // Đóng modal
          this.onClose();
        } else {
          this.errorMessage = response?.message || 'Có lỗi xảy ra khi tạo thanh toán VNPay';
        }
      } else if (this.selectedPaymentMethod === 'zalopay') {
        // Gọi API ZaloPay riêng với thông tin chi tiết
        const zaloPayRequest: ZaloPayRequest = {
          courseId: this.course.courseId,
          amount: this.course.price,
          orderInfo: `Thanh toan khoa hoc: ${this.course.title}`,
          description: `Khoa hoc: ${this.course.title} - Giang vien: ${this.course.instructorName || 'Chua co thong tin'}`
        };

        const response = await this.paymentService.createZaloPayPayment(zaloPayRequest).toPromise();
        
        if (response && response.success) {
          // Mở URL ZaloPay trong tab mới
          if (response.paymentUrl) {
            window.open(response.paymentUrl, '_blank');
          }
          
          // Emit success event
          this.paymentSuccess.emit(response);
          
          // Đóng modal
          this.onClose();
        } else {
          this.errorMessage = response?.message || 'Có lỗi xảy ra khi tạo thanh toán ZaloPay';
        }
      } else {
        // Xử lý các phương thức thanh toán khác
        const paymentRequest: PaymentRequest = {
          courseId: this.course.courseId,
          paymentMethod: this.selectedPaymentMethod,
          amount: this.course.price
        };

        const response = await this.paymentService.createPayment(paymentRequest).toPromise();
        
        if (response && response.success) {
          // Mở URL thanh toán trong tab mới
          if (response.paymentUrl) {
            this.paymentService.openPaymentUrl(response.paymentUrl);
          }
          
          // Emit success event
          this.paymentSuccess.emit(response);
          
          // Đóng modal
          this.onClose();
        } else {
          this.errorMessage = response?.message || 'Có lỗi xảy ra khi tạo thanh toán';
        }
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      this.errorMessage = error.error?.message || error.message || 'Có lỗi xảy ra khi tạo thanh toán';
    } finally {
      this.isLoading = false;
    }
  }

  formatCurrency(amount: number): string {
    return this.paymentService.formatCurrency(amount);
  }
  
}
