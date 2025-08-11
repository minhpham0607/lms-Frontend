import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private isLoggedInSubject = new BehaviorSubject<boolean>(false);
  public isLoggedIn$ = this.isLoggedInSubject.asObservable();
  public authStatus$ = this.isLoggedIn$; // Alias cho tương thích

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private router: Router,
    private notificationService: NotificationService
  ) {
    // Khởi tạo trạng thái đăng nhập
    this.initializeAuthState();
  }

  private initializeAuthState(): void {
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('token');
      const isValid = this.isTokenValid(token);
      this.isLoggedInSubject.next(isValid);

      if (!isValid && token) {
        // Token không hợp lệ, xóa nó
        localStorage.removeItem('token');
      }
    }
  }

  public isTokenValid(token: string | null): boolean {
    if (!token) return false;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      return payload.exp > currentTime;
    } catch (error) {
      return false;
    }
  }

  public login(token: string): void {
    if (isPlatformBrowser(this.platformId)) {
      // Clear any existing session
      this.logout(false);

      // Set new session
      localStorage.setItem('token', token);
      this.isLoggedInSubject.next(true);
      console.log('✅ Session established');
    }
  }

  public logout(showAlert: boolean = true): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('token');
      // Xóa avatar session để lần đăng nhập tiếp theo chọn avatar mới
      sessionStorage.removeItem('session_avatar');
      this.isLoggedInSubject.next(false);
      console.log('👋 Session cleared');

      // Chuyển hướng về trang login
      this.router.navigate(['/login']);
    }
  }

  public getCurrentUser(): any {
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('token');

      if (token && this.isTokenValid(token)) {
        try {
          const decoded = JSON.parse(atob(token.split('.')[1]));
          return decoded;
        } catch (error) {
          console.error('❌ Error decoding JWT:', error);
          return null;
        }
      }
    }
    return null;
  }

  public getUserRole(): string | null {
    const user = this.getCurrentUser();
    return user ? user.role : null;
  }

  public getUsername(): string | null {
    const user = this.getCurrentUser();
    return user ? user.sub : null;
  }

  public getFullName(): string | null {
    const user = this.getCurrentUser();
    return user ? user.fullName : null;
  }

  public getUserId(): number | null {
    const user = this.getCurrentUser();
    return user ? user.userId : null;
  }

  public isAdmin(): boolean {
    const role = this.getUserRole();
    const normalizedRole = role ? role.replace('ROLE_', '') : '';
    return normalizedRole === 'admin' || normalizedRole === 'ADMIN';
  }

  public isInstructor(): boolean {
    const role = this.getUserRole();
    const normalizedRole = role ? role.replace('ROLE_', '') : '';
    return normalizedRole === 'instructor' || normalizedRole === 'INSTRUCTOR';
  }

  public isStudent(): boolean {
    const role = this.getUserRole();
    const normalizedRole = role ? role.replace('ROLE_', '') : '';
    return normalizedRole === 'student' || normalizedRole === 'STUDENT';
  }

  public forceLogout(message: string = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'): void {
    this.logout(false);
    if (isPlatformBrowser(this.platformId)) {
      alert(message);
    }
    this.router.navigate(['/login']);
  }

  // ✅ Thêm phương thức quản lý avatar
  public getAvatarUrl(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return sessionStorage.getItem('session_avatar');
    }
    return null;
  }

  public setAvatarUrl(url: string): void {
    if (isPlatformBrowser(this.platformId)) {
      sessionStorage.setItem('session_avatar', url);
    }
  }
}
