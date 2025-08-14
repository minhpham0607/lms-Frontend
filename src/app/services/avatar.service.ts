import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AvatarService {
  private readonly BASE_URL = 'http://localhost:8080';

  constructor(private http: HttpClient) { }

  /**
   * Process avatar URL to add base URL if needed
   * @param avatarUrl - The avatar URL from backend
   * @returns Full URL to avatar or null if no avatar
   */
  processAvatarUrl(avatarUrl: string | null | undefined): string | null {
    
    if (!avatarUrl) {
      return null;
    }

    // Nếu URL bắt đầu bằng http(s), giữ nguyên
    if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
      return avatarUrl;
    }

    // Nếu URL bắt đầu bằng /uploads/avatars/, thêm base URL
    if (avatarUrl.startsWith('/uploads/avatars/')) {
      const directUrl = `${this.BASE_URL}${avatarUrl}`;
      return directUrl;
    }

    // Nếu bắt đầu bằng /, thêm base URL
    if (avatarUrl.startsWith('/')) {
      const fullUrl = `${this.BASE_URL}${avatarUrl}`;
      return fullUrl;
    }

    // Nếu chỉ là filename, thêm đường dẫn đầy đủ
    const fullUrl = `${this.BASE_URL}/uploads/avatars/${avatarUrl}`;
    return fullUrl;
  }

  /**
   * Lấy avatar URL cuối cùng với xử lý lỗi đơn giản
   * @param avatarUrl - URL gốc
   * @returns string - URL có thể sử dụng
   */
  getValidAvatarUrl(avatarUrl: string | null | undefined): string {
    const processedUrl = this.processAvatarUrl(avatarUrl);
    return processedUrl || this.getDefaultAvatarUrl();
  }

  /**
   * Lấy avatar với fallback mechanism
   * @param avatarUrl - URL gốc của avatar
   * @returns Observable<string> - URL cuối cùng có thể load được
   */
  getAvatarWithFallback(avatarUrl: string | null | undefined): Observable<string> {
    return new Observable(observer => {
      if (!avatarUrl) {
        observer.next(this.getDefaultAvatarUrl());
        observer.complete();
        return;
      }

      const processedUrl = this.processAvatarUrl(avatarUrl);
      if (!processedUrl) {
        observer.next(this.getDefaultAvatarUrl());
        observer.complete();
        return;
      }

      // Thử load URL đã xử lý
      this.checkAvatarExists(processedUrl).subscribe(exists => {
        if (exists) {
          observer.next(processedUrl);
          observer.complete();
        } else {
          // Nếu không load được, thử các URL thay thế
          if (avatarUrl.startsWith('/uploads/avatars/')) {
            const filename = avatarUrl.split('/').pop();
            const fallbackUrls = [
              // Thử các endpoint có thể có trong Spring Boot
              `${this.BASE_URL}/api/users/avatar/${filename}`,
              `${this.BASE_URL}/api/files/${filename}`,
              `${this.BASE_URL}/images/avatars/${filename}`,
              `${this.BASE_URL}/static/uploads/avatars/${filename}`,
              `${this.BASE_URL}/resources/static/uploads/avatars/${filename}`,
              // Thử direct access với các path khác
              `${this.BASE_URL}/uploads/${filename}`,
              `${this.BASE_URL}/files/avatars/${filename}`
            ];

            this.tryFallbackUrls(fallbackUrls, 0, observer);
          } else {
            observer.next(this.getDefaultAvatarUrl());
            observer.complete();
          }
        }
      });
    });
  }

  /**
   * Kiểm tra xem avatar có tồn tại không
   * @param avatarUrl - URL của avatar cần kiểm tra
   * @returns Observable<boolean>
   */
  checkAvatarExists(avatarUrl: string): Observable<boolean> {
    return new Observable(observer => {
      const img = new Image();
      img.onload = () => {
        observer.next(true);
        observer.complete();
      };
      img.onerror = () => {
        observer.next(false);
        observer.complete();
      };
      img.src = avatarUrl;
    });
  }

  /**
   * Thử các URL fallback một cách tuần tự
   */
  private tryFallbackUrls(urls: string[], index: number, observer: any): void {
    if (index >= urls.length) {
      observer.next(this.getDefaultAvatarUrl());
      observer.complete();
      return;
    }

    this.checkAvatarExists(urls[index]).subscribe((exists: boolean) => {
      if (exists) {
        observer.next(urls[index]);
        observer.complete();
      } else {
        this.tryFallbackUrls(urls, index + 1, observer);
      }
    });
  }

  /**
   * Lấy URL avatar mặc định
   * @returns string
   */
  getDefaultAvatarUrl(): string {
    return 'assets/pictures/logocmc.png'; // Sử dụng logo CMC làm avatar mặc định
  }

  /**
   * Test trực tiếp một avatar URL cụ thể (cho debugging)
   * @param avatarUrl - URL cần test
   */
  testAvatarUrl(avatarUrl: string): void {
    
    const img = new Image();
    img.onload = () => {
    };
    img.onerror = (error) => {
    };
    img.src = avatarUrl;
  }

  /**
   * Test tất cả các URL có thể cho một avatar
   * @param originalPath - Đường dẫn gốc từ database
   */
  testAllPossibleUrls(originalPath: string): void {
    
    const filename = originalPath.split('/').pop();
    const testUrls = [
      `${this.BASE_URL}${originalPath}`,
      `${this.BASE_URL}/api/users/avatar/${filename}`,
      `${this.BASE_URL}/api/files/${filename}`,
      `${this.BASE_URL}/images/avatars/${filename}`,
      `${this.BASE_URL}/static/uploads/avatars/${filename}`,
      `${this.BASE_URL}/uploads/${filename}`,
      `${this.BASE_URL}/files/avatars/${filename}`
    ];

    testUrls.forEach((url, index) => {
      setTimeout(() => {
        this.testAvatarUrl(`${index + 1}. ${url}`);
      }, index * 500); // Delay để không spam requests
    });
  }

  /**
   * Xử lý lỗi avatar và trả về avatar mặc định
   * @param originalUrl - URL gốc bị lỗi
   * @returns string
   */
  handleAvatarError(originalUrl: string): string {
    return this.getDefaultAvatarUrl();
  }
}