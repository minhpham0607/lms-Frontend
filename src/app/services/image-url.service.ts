import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ImageUrlService {
  private readonly BACKEND_URL = 'http://localhost:8080';

  /**
   * Process image URL to support both local and Cloudinary URLs
   * @param imageUrl - URL from backend
   * @param fallbackPath - fallback image path
   */
  getImageUrl(imageUrl: string | null | undefined, fallbackPath?: string): string {
    // If no URL provided, use fallback
    if (!imageUrl) {
      return fallbackPath || 'assets/pictures/default-course.png';
    }
    
    // If URL already starts with http/https (Cloudinary), return as is
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    
    // If it starts with /, it's a backend relative URL (legacy local files)
    if (imageUrl.startsWith('/')) {
      return `${this.BACKEND_URL}${imageUrl}`;
    }
    
    // Legacy: If it's just a filename, construct old path for course images
    return `${this.BACKEND_URL}/images/courses/${imageUrl}`;
  }

  /**
   * Get avatar URL with proper fallback
   */
  getAvatarUrl(avatarUrl: string | null | undefined): string {
    // If no URL provided, use default avatar
    if (!avatarUrl) {
      return 'assets/pictures/avt.png';
    }
    
    // If URL already starts with http/https (Cloudinary), return as is
    if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
      return avatarUrl;
    }
    
    // If it starts with /, it's a backend relative URL
    if (avatarUrl.startsWith('/')) {
      return `${this.BACKEND_URL}${avatarUrl}`;
    }
    
    // Legacy: construct old path
    return `${this.BACKEND_URL}/uploads/avatars/${avatarUrl}`;
  }

  /**
   * Get video URL (for video thumbnails if needed)
   */
  getVideoUrl(videoUrl: string | null | undefined): string {
    if (!videoUrl) {
      return '';
    }
    
    // If URL already starts with http/https (Cloudinary), return as is
    if (videoUrl.startsWith('http://') || videoUrl.startsWith('https://')) {
      return videoUrl;
    }
    
    // If it starts with /, it's a backend relative URL
    if (videoUrl.startsWith('/')) {
      return `${this.BACKEND_URL}${videoUrl}`;
    }
    
    // Legacy: construct old path
    return `${this.BACKEND_URL}/videos/${videoUrl}`;
  }
}
