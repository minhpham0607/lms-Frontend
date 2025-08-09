import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface CourseReview {
  reviewId?: number;
  courseId: number;
  courseTitle: string;
  courseImage?: string;
  description?: string;
  userId?: number;
  fullName?: string;
  avatarUrl?: string;
  rating: number;
  comment?: string;
  createdAt?: string;
  hasReviewed?: boolean;
  completionPercentage?: number; // New field for completion percentage
}

export interface ReviewRequest {
  courseId: number;
  rating: number;
  comment?: string;
}

export interface CourseCompletionDTO {
  courseId: number;
  courseTitle: string;
  completionPercentage: number;
  totalModules: number;
  completedModules: number;
  totalItems: number;
  completedItems: number;
  totalContents: number;
  completedContents: number;
  totalVideos: number;
  completedVideos: number;
  totalQuizzes: number;
  completedQuizzes: number;
}

@Injectable({
  providedIn: 'root'
})
export class CourseReviewService {
  private apiUrl = '/course-reviews';
  private moduleApiUrl = '/modules';

  constructor(private apiService: ApiService) { }

  // Get courses eligible for review (completion >= 80%)
  getEligibleCourses(): Observable<CourseReview[]> {
    return this.apiService.get<CourseReview[]>(`${this.apiUrl}/eligible`);
  }

  // Get course completion percentage
  getCourseCompletion(courseId: number): Observable<CourseCompletionDTO> {
    return this.apiService.get<CourseCompletionDTO>(`${this.moduleApiUrl}/course/${courseId}/completion`);
  }

  // Get reviews by course
  getReviewsByCourse(courseId: number): Observable<CourseReview[]> {
    return this.apiService.get<CourseReview[]>(`${this.apiUrl}/course/${courseId}`);
  }

  // Get my review for a course
  getMyReview(courseId: number): Observable<CourseReview> {
    return this.apiService.get<CourseReview>(`${this.apiUrl}/my-review/${courseId}`);
  }

  // Get all reviews for instructor
  getInstructorCourseReviews(): Observable<CourseReview[]> {
    return this.apiService.get<CourseReview[]>(`${this.apiUrl}/instructor`);
  }

  // Get all reviews for admin
  getAllReviews(): Observable<CourseReview[]> {
    return this.apiService.get<CourseReview[]>(`${this.apiUrl}/all`);
  }

  // Create or update review
  createOrUpdateReview(review: ReviewRequest): Observable<CourseReview> {
    return this.apiService.post<CourseReview>(`${this.apiUrl}`, review);
  }

  // Delete review (admin only)
  deleteReview(reviewId: number): Observable<void> {
    return this.apiService.delete<void>(`${this.apiUrl}/${reviewId}`);
  }
}
