import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = 'http://localhost:8080/api';
  private tokenKey = 'token';
  private refreshTokenKey = 'refreshToken';
  private currentUserSubject = new BehaviorSubject<any>(null);

  constructor(private http: HttpClient) {
    // Load user from token on service init
    this.loadUserFromToken();
  }

  login(data: { username: string; password: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/users/login`, data).pipe(
      tap((response: any) => {
        if (response.token) {
          this.setToken(response.token);
          if (response.refreshToken) {
            this.setRefreshToken(response.refreshToken);
          }
          this.loadUserFromToken();
        }
      })
    );
  }

  // 📌 Đăng ký: gửi dữ liệu theo multipart/form-data nếu có file
  register(
  data: {
    username: string;
    password: string;
    email: string;
    fullName: string;
    role: string;
    isVerified?: boolean; // 👈 thêm nếu muốn gửi
  },
  cvFile?: File | null
): Observable<any> {
  const formData = new FormData();
  formData.append('username', data.username);
  formData.append('password', data.password);
  formData.append('email', data.email);
  formData.append('fullName', data.fullName);
  formData.append('role', data.role);

  if (data.role === 'instructor' && cvFile) {
    formData.append('cv', cvFile);
  }

  // ✅ Nếu là student hoặc admin và có isVerified → gửi
  if ((data.role === 'student' || data.role === 'admin') && data.isVerified !== undefined) {
    formData.append('isVerified', String(data.isVerified));
  }

    return this.http.post(`${this.apiUrl}/users/register`, formData);
  }

  // Token management
  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.refreshTokenKey);
  }

  setRefreshToken(token: string): void {
    localStorage.setItem(this.refreshTokenKey, token);
  }

  // Refresh token
  refreshToken(): Observable<any> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    return this.http.post(`${this.apiUrl}/auth/refresh`, { refreshToken }).pipe(
      tap((response: any) => {
        if (response.token) {
          this.setToken(response.token);
          if (response.refreshToken) {
            this.setRefreshToken(response.refreshToken);
          }
          this.loadUserFromToken();
        }
      })
    );
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiresAt = payload.exp * 1000;
      return Date.now() < expiresAt;
    } catch {
      return false;
    }
  }

  // Get current user info from token
  getCurrentUser(): any {
    return this.currentUserSubject.value;
  }

  getCurrentUser$(): Observable<any> {
    return this.currentUserSubject.asObservable();
  }

  // Load user info from token
  private loadUserFromToken(): void {
    const token = this.getToken();
    if (!token) {
      this.currentUserSubject.next(null);
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      this.currentUserSubject.next(payload);
    } catch {
      this.currentUserSubject.next(null);
    }
  }

  // Logout
  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.refreshTokenKey);
    this.currentUserSubject.next(null);
  }

  // Get user role
  getUserRole(): string | null {
    const user = this.getCurrentUser();
    return user?.role || null;
  }

  // Check if user has specific role
  hasRole(role: string): boolean {
    const userRole = this.getUserRole();
    return userRole === role;
  }
}

