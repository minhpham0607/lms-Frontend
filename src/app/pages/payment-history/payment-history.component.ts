import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaymentService, PaymentHistory } from '../../services/payment.service';

@Component({
  selector: 'app-payment-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './payment-history.component.html',
  styleUrls: ['./payment-history.component.scss']
})
export class PaymentHistoryComponent implements OnInit {
  payments: PaymentHistory[] = [];
  isLoading = true;
  errorMessage = '';

  constructor(private paymentService: PaymentService) {}

  ngOnInit() {
    this.loadPaymentHistory();
  }

  async loadPaymentHistory() {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      this.payments = await this.paymentService.getPaymentHistory().toPromise() || [];
    } catch (error: any) {
      console.error('Error loading payment history:', error);
      this.errorMessage = 'Có lỗi xảy ra khi tải lịch sử thanh toán';
    } finally {
      this.isLoading = false;
    }
  }

  async retryCallback(payment: PaymentHistory) {
    if (payment.status !== 'pending') {
      return;
    }

    try {
      const response = await this.paymentService.simulatePaymentCallback(
        payment.transactionId, 
        'success'
      ).toPromise();

      if (response && response.success) {
        // Reload payment history
        await this.loadPaymentHistory();
      }
    } catch (error) {
      console.error('Error simulating callback:', error);
    }
  }

  formatCurrency(amount: number): string {
    return this.paymentService.formatCurrency(amount);
  }

  formatDate(dateString: string): string {
    return this.paymentService.formatDate(dateString);
  }

  getPaymentMethodName(method: string): string {
    return this.paymentService.getPaymentMethodName(method);
  }

  getStatusClass(status: string): string {
    return this.paymentService.getStatusClass(status);
  }

  getStatusName(status: string): string {
    return this.paymentService.getStatusName(status);
  }

  trackByPaymentId(index: number, payment: PaymentHistory): number {
    return payment.paymentId;
  }
}
