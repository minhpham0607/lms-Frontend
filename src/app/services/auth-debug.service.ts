import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

interface TokenInfo {
  token: string | null;
  isValid: boolean;
  payload: any;
  expiresAt: Date | null;
  isExpired: boolean;
  timeUntilExpiry: string;
}

interface APITestResult {
  endpoint: string;
  status: 'success' | 'error';
  statusCode?: number;
  error?: string;
  data?: any;
  headers?: any;
}

@Injectable({
  providedIn: 'root'
})
export class AuthDebugService {
  private baseUrl = 'http://localhost:8080/api';

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private http: HttpClient
  ) {}

  // Debug current authentication state
  debugAuthState(): void {
    if (!isPlatformBrowser(this.platformId)) {
      console.log('🌐 Running on server - authentication not available');
      return;
    }

    const token = localStorage.getItem('token');
    const userInfo = localStorage.getItem('userInfo');
    const username = localStorage.getItem('username');
    const role = localStorage.getItem('role');

    console.group('🔍 Authentication Debug Info');
    console.log('Token exists:', !!token);
    console.log('Token preview:', token ? `${token.substring(0, 20)}...` : 'None');
    console.log('User info:', userInfo ? JSON.parse(userInfo) : 'None');
    console.log('Username:', username || 'None');
    console.log('Role:', role || 'None');
    
    // Check if token is expired (if it's a JWT)
    if (token && this.isJWT(token)) {
      try {
        const payload = this.parseJWT(token);
        const isExpired = this.isTokenExpired(payload);
        console.log('Token expired:', isExpired);
        console.log('Token expires at:', new Date(payload.exp * 1000));
      } catch (error) {
        console.log('Error parsing token:', error);
      }
    }
    
    console.groupEnd();
  }

  /**
   * Kiểm tra thông tin chi tiết về token hiện tại
   */
  getTokenInfo(): TokenInfo {
    if (!isPlatformBrowser(this.platformId)) {
      return {
        token: null,
        isValid: false,
        payload: null,
        expiresAt: null,
        isExpired: true,
        timeUntilExpiry: 'Server side'
      };
    }

    const token = localStorage.getItem('token');
    
    if (!token) {
      return {
        token: null,
        isValid: false,
        payload: null,
        expiresAt: null,
        isExpired: true,
        timeUntilExpiry: 'No token'
      };
    }

    try {
      // Decode JWT payload
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiresAt = payload.exp ? new Date(payload.exp * 1000) : null;
      const isExpired = expiresAt ? expiresAt.getTime() < Date.now() : false;
      
      let timeUntilExpiry = 'Unknown';
      if (expiresAt) {
        const timeDiff = expiresAt.getTime() - Date.now();
        if (timeDiff > 0) {
          const minutes = Math.floor(timeDiff / (1000 * 60));
          const hours = Math.floor(minutes / 60);
          const days = Math.floor(hours / 24);
          
          if (days > 0) {
            timeUntilExpiry = `${days} ngày ${hours % 24} giờ`;
          } else if (hours > 0) {
            timeUntilExpiry = `${hours} giờ ${minutes % 60} phút`;
          } else {
            timeUntilExpiry = `${minutes} phút`;
          }
        } else {
          timeUntilExpiry = 'Đã hết hạn';
        }
      }

      return {
        token: token.substring(0, 50) + '...',
        isValid: true,
        payload,
        expiresAt,
        isExpired,
        timeUntilExpiry
      };
    } catch (error) {
      return {
        token: token.substring(0, 50) + '...',
        isValid: false,
        payload: null,
        expiresAt: null,
        isExpired: true,
        timeUntilExpiry: 'Token không hợp lệ'
      };
    }
  }

  /**
   * Test kết nối đến các API endpoints
   */
  async testAPIEndpoints(): Promise<APITestResult[]> {
    if (!isPlatformBrowser(this.platformId)) {
      return [{
        endpoint: 'Server Side',
        status: 'error',
        error: 'Cannot test API on server side'
      }];
    }

    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    const endpoints = [
      { name: 'User Profile', url: `${this.baseUrl}/users/me` },
      { name: 'Courses', url: `${this.baseUrl}/courses` },
      { name: 'Enrollments', url: `${this.baseUrl}/enrollments` },
      { name: 'My Courses', url: `${this.baseUrl}/enrollments/my-courses` },
      { name: 'Statistics', url: `${this.baseUrl}/enrollments/statistics` }
    ];

    const results: APITestResult[] = [];

    for (const endpoint of endpoints) {
      try {
        console.log(`🔍 Testing ${endpoint.name}: ${endpoint.url}`);
        
        const response = await firstValueFrom(
          this.http.get(endpoint.url, { 
            headers,
            observe: 'response'
          })
        );

        results.push({
          endpoint: endpoint.name,
          status: 'success',
          statusCode: response.status,
          data: response.body,
          headers: this.extractHeaders(response.headers)
        });

        console.log(`✅ ${endpoint.name}: Success (${response.status})`);
      } catch (error: any) {
        const httpError = error as HttpErrorResponse;
        results.push({
          endpoint: endpoint.name,
          status: 'error',
          statusCode: httpError.status,
          error: httpError.message,
          headers: httpError.headers ? this.extractHeaders(httpError.headers) : null
        });

        console.log(`❌ ${endpoint.name}: Error ${httpError.status} - ${httpError.message}`);
      }
    }

    return results;
  }

  /**
   * Chạy tất cả các test và hiển thị kết quả
   */
  async runFullDiagnostic(): Promise<void> {
    console.log('🔧 === BẮT ĐẦU CHẨN ĐOÁN AUTHENTICATION === 🔧');
    
    // 1. Kiểm tra token info
    const tokenInfo = this.getTokenInfo();
    console.log('🎫 TOKEN INFO:', tokenInfo);
    
    // 2. Test API endpoints
    const apiResults = await this.testAPIEndpoints();
    console.log('📡 API ENDPOINTS:', apiResults);
    
    // 3. Tổng kết
    const successCount = apiResults.filter(r => r.status === 'success').length;
    const errorCount = apiResults.filter(r => r.status === 'error').length;
    
    console.log('📊 === TỔNG KẾT === 📊');
    console.log(`✅ Thành công: ${successCount}/${apiResults.length} endpoints`);
    console.log(`❌ Lỗi: ${errorCount}/${apiResults.length} endpoints`);
    
    if (tokenInfo.isExpired) {
      console.log('⚠️ CẢNH BÁO: Token đã hết hạn!');
    }
    
    if (errorCount > 0) {
      console.log('🛠️ GỢI Ý KHẮC PHỤC:');
      console.log('1. Kiểm tra xem server có đang chạy không');
      console.log('2. Thử đăng nhập lại để lấy token mới');
      console.log('3. Kiểm tra CORS configuration trên server');
      console.log('4. Verify server API endpoints');
    }
  }

  /**
   * Fix authentication issues
   */
  async attemptFix(): Promise<{ success: boolean; message: string }> {
    if (!isPlatformBrowser(this.platformId)) {
      return { success: false, message: 'Cannot fix on server side' };
    }

    try {
      console.log('🔧 Attempting to fix authentication issues...');
      
      const tokenInfo = this.getTokenInfo();
      
      if (!tokenInfo.token) {
        return { 
          success: false, 
          message: 'Không có token. Cần đăng nhập lại.' 
        };
      }
      
      if (tokenInfo.isExpired) {
        // Clear expired token
        this.clearAuthData();
        return { 
          success: false, 
          message: 'Token đã hết hạn. Cần đăng nhập lại.' 
        };
      }
      
      return { 
        success: true, 
        message: 'Token hợp lệ. Không cần sửa.' 
      };
      
    } catch (error: any) {
      return { 
        success: false, 
        message: `Không thể khắc phục: ${error.message}` 
      };
    }
  }

  // Check if token is valid and not expired
  isTokenValid(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      console.log('❌ No token found');
      return false;
    }

    if (this.isJWT(token)) {
      try {
        const payload = this.parseJWT(token);
        const isExpired = this.isTokenExpired(payload);
        if (isExpired) {
          console.log('❌ Token is expired');
          return false;
        }
      } catch (error) {
        console.log('❌ Invalid token format');
        return false;
      }
    }

    console.log('✅ Token is valid');
    return true;
  }

  // Force refresh auth state
  refreshAuthState(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    console.log('🔄 Refreshing authentication state...');
    
    // Check if we should redirect to login
    if (!this.isTokenValid()) {
      console.log('🚪 Invalid token - should redirect to login');
      // You can emit an event here or use a service to handle logout
    }
  }

  // Clear all auth data
  clearAuthData(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    console.log('🧹 Clearing authentication data...');
    localStorage.removeItem('token');
    localStorage.removeItem('userInfo');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    localStorage.removeItem('avatarUrl');
  }

  /**
   * Extract headers từ HTTP response
   */
  private extractHeaders(headers: any): any {
    const extracted: any = {};
    if (headers && headers.keys) {
      headers.keys().forEach((key: string) => {
        extracted[key] = headers.get(key);
      });
    }
    return extracted;
  }

  // Helper methods
  private isJWT(token: string): boolean {
    return token.split('.').length === 3;
  }

  private parseJWT(token: string): any {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  }

  private isTokenExpired(payload: any): boolean {
    if (!payload.exp) {
      return false; // No expiration set
    }
    const now = Math.floor(Date.now() / 1000);
    return payload.exp < now;
  }
}
