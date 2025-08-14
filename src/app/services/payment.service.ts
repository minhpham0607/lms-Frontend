import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PaymentRequest {
  courseId: number;
  paymentMethod: string;
  amount: number;
}

export interface VNPayRequest {
  courseId: number;
  amount: number;
  orderInfo: string;
}

export interface ZaloPayRequest {
  courseId: number;
  amount: number;
  orderInfo: string;
  description?: string;
}

export interface PaymentResponse {
  success: boolean;
  message: string;
  paymentId?: number;
  paymentUrl?: string;
  transactionId?: string;
  coursePrice?: number;
  courseId?: number;
  requirePayment?: boolean;
}

export interface PaymentHistory {
  paymentId: number;
  courseId: number;
  courseTitle: string;
  amount: number;
  status: string;
  paymentMethod: string;
  transactionId: string;
  createdAt: string;
  paidAt: string;
}

export interface PaymentCheckResponse {
  courseId: number;
  userId: number;
  hasPaid: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private apiUrl = 'http://localhost:8080/api/payments';

  constructor(private http: HttpClient) { }

  /**
   * Tạo payment cho khóa học có phí
   */
  createPayment(request: PaymentRequest): Observable<PaymentResponse> {
    return this.http.post<PaymentResponse>(`${this.apiUrl}/create`, request);
  }

  /**
   * Callback từ cổng thanh toán (chỉ dùng để test)
   */
  simulatePaymentCallback(transactionId: string, status: string): Observable<PaymentResponse> {
    const params = new HttpParams()
      .set('transactionId', transactionId)
      .set('status', status);
    
    return this.http.post<PaymentResponse>(`${this.apiUrl}/callback`, null, { params });
  }

  /**
   * Lấy lịch sử thanh toán của user hiện tại
   */
  getPaymentHistory(): Observable<PaymentHistory[]> {
    return this.http.get<PaymentHistory[]>(`${this.apiUrl}/history`);
  }

  /**
   * Kiểm tra user đã thanh toán cho khóa học chưa
   */
  checkPaymentStatus(courseId: number): Observable<PaymentCheckResponse> {
    return this.http.get<PaymentCheckResponse>(`${this.apiUrl}/check/${courseId}`);
  }

  /**
   * Lấy danh sách thanh toán của khóa học (cho instructor/admin)
   */
  getCoursePayments(courseId: number): Observable<PaymentHistory[]> {
    return this.http.get<PaymentHistory[]>(`${this.apiUrl}/course/${courseId}`);
  }

  /**
   * Mở URL thanh toán trong tab mới
   */
  openPaymentUrl(paymentUrl: string): void {
    window.open(paymentUrl, '_blank');
  }

  /**
   * Format số tiền VND
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  }

  /**
   * Format ngày tháng
   */
  formatDate(dateString: string): string {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString('vi-VN');
  }

  /**
   * Lấy tên hiển thị của phương thức thanh toán
   */
  getPaymentMethodName(method: string): string {
    const methods: { [key: string]: string } = {
      'vnpay': 'VNPay',
      'momo': 'MoMo',
      'zalopay': 'ZaloPay',
      'credit_card': 'Thẻ tín dụng',
      'bank_transfer': 'Chuyển khoản ngân hàng'
    };
    return methods[method] || method;
  }

  /**
   * Lấy class CSS cho trạng thái thanh toán
   */
  getStatusClass(status: string): string {
    const statusClasses: { [key: string]: string } = {
      'pending': 'text-warning',
      'completed': 'text-success',
      'failed': 'text-danger',
      'refunded': 'text-secondary'
    };
    return statusClasses[status] || 'text-muted';
  }

  /**
   * Lấy tên hiển thị của trạng thái thanh toán
   */
  getStatusName(status: string): string {
    const statusNames: { [key: string]: string } = {
      'pending': 'Đang chờ',
      'completed': 'Hoàn thành',
      'failed': 'Thất bại',
      'refunded': 'Đã hoàn tiền'
    };
    return statusNames[status] || status;
  }

  /**
   * Tạo payment VNPay riêng với thông tin chi tiết
   */
  createVNPayPayment(request: VNPayRequest): Observable<PaymentResponse> {
    return this.http.post<PaymentResponse>(`${this.apiUrl}/vnpay`, request);
  }

  /**
   * Kiểm tra config VNPay
   */
  getVNPayConfig(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/vnpay-config`);
  }

  /**
   * Xác nhận thanh toán VNPay (gọi callback)
   */
  confirmVNPayPayment(queryParams: string): Observable<PaymentResponse> {
    return this.http.get<PaymentResponse>(`${this.apiUrl}/vnpay-callback${queryParams}`);
  }

  /**
   * Kiểm tra trạng thái thanh toán theo transaction ID
   */
  checkPaymentByTransaction(transactionId: string): Observable<any> {
    return this.http.get<any>(`http://localhost:8080/api/payment-status/check/${transactionId}`);
  }

  /**
   * Tạo payment ZaloPay với thông tin chi tiết
   */
  createZaloPayPayment(request: ZaloPayRequest): Observable<PaymentResponse> {
    return this.http.post<PaymentResponse>(`${this.apiUrl}/zalopay`, request);
  }

  /**
   * Kiểm tra config ZaloPay
   */
  getZaloPayConfig(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/zalopay-config`);
  }

  /**
   * Xác nhận thanh toán ZaloPay (callback)
   */
  confirmZaloPayPayment(queryParams: string): Observable<PaymentResponse> {
    return this.http.get<PaymentResponse>(`${this.apiUrl}/zalopay-callback${queryParams}`);
  }

  /**
   * Kiểm tra trạng thái đơn hàng ZaloPay
   */
  checkZaloPayOrderStatus(apptransid: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/zalopay-status/${apptransid}`);
  }
}
