import { Component, OnInit, OnDestroy, ViewChild, ElementRef, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../../services/api.service';
import { SessionService } from '../../../services/session.service';
import { NotificationService } from '../../../services/notification.service';
import { NotificationComponent } from '../../../components/notification/notification.component';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../../../components/sidebar/sidebar.component';
import { ProfileComponent } from '../../../components/profile/profile.component';
import { UserService } from '../../../services/user.service';
import { ModuleContentService } from '../../../services/module-content.service';

@Component({
  selector: 'app-learn-online',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent, ProfileComponent, NotificationComponent],
  templateUrl: './learn-online.component.html',
  styleUrls: ['./learn-online.component.scss']
})
export class LearnOnlineComponent implements OnInit, OnDestroy {
  dropdownOpen = false;
  videos: any[] = [];
  currentVideo: any = null;
  courseId: number | null = null; // Dynamic courseId
  courses: any[] = []; // Available courses for user
  currentCourseName: string = 'Khóa học'; // Current course name
  loading = false;
  hasNoVideos = false; // Track if course has no videos
  private currentBlobUrl: string | null = null; // Lưu blob URL hiện tại
  private totalSeekTime = 0; // Tổng thời gian đã tua (giây)
  private maxTotalSeekTime = 120; // Tối đa 2 phút (120 giây) cho toàn bộ video
  private fromModule: boolean = false; // Track if navigated from module page

  // Profile component properties
  username: string = '';
  userRole: string = '';
  avatarUrl: string = '';

  @ViewChild('classroomVideo', { static: false }) videoPlayer?: ElementRef<HTMLVideoElement>;

  constructor(
    private http: HttpClient,
    private apiService: ApiService,
    private route: ActivatedRoute,
    private sessionService: SessionService,
    private userService: UserService,
    private notificationService: NotificationService,
    private moduleContentService: ModuleContentService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    // Chỉ load data khi đang chạy ở browser (có localStorage)
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    // Initialize user profile data
    this.initializeUserProfile();

    // Check for courseId and videoId from query params first
    this.route.queryParams.subscribe(params => {
      if (params['courseId']) {
        this.courseId = parseInt(params['courseId']);

        // Check if navigated from module page
        this.fromModule = !!params['videoId']; // If videoId exists, came from module

        // If videoId is provided, load specific video directly
        if (params['videoId']) {
          const videoId = parseInt(params['videoId']);
          const moduleId = params['moduleId'] ? parseInt(params['moduleId']) : null;

          // Load and play specific video
          this.loadSpecificVideo(videoId, moduleId);
        } else {
          this.loadUserCourses();
        }
      } else {
        this.loadUserCourses();
      }
    });
  }

  ngOnDestroy() {
    // Cleanup blob URL khi component bị destroy
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
  }

  // Initialize user profile data from session
  private initializeUserProfile() {
    const userInfo = this.userService.getCurrentUserInfo();
    this.username = userInfo.username;
    this.userRole = userInfo.role; // Giữ nguyên role gốc
    this.avatarUrl = userInfo.avatarUrl; // ✅ Sử dụng avatar mặc định từ service
  }

  // Format role để hiển thị (chữ cái đầu viết hoa)
  getDisplayRole(role: string): string {
    const cleanRole = role.replace('ROLE_', '').toLowerCase();
    return cleanRole.charAt(0).toUpperCase() + cleanRole.slice(1);
  }

  // Helper method để hiển thị thông báo
  private showAlert(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
    if (type === 'success') {
      this.notificationService.success('Thành công', message);
    } else if (type === 'error') {
      this.notificationService.error('Lỗi', message);
    } else if (type === 'warning') {
      this.notificationService.warning('Cảnh báo', message);
    } else {
      this.notificationService.info('Thông báo', message);
    }
  }

  // Determine if video list should be shown
  shouldShowVideoList(): boolean {
    // For students who came from module page, hide the video list
    if (this.sessionService.isStudent() && this.fromModule) {
      return false;
    }
    // For instructors/admins or students who navigated directly, show video list
    return true;
  }

  // Show message when course has no videos
  private showNoVideosMessage() {
    this.hasNoVideos = true;
    this.currentVideo = null;
  }

  // Get current course name for display
  getCurrentCourseName(): string {
    return this.currentCourseName;
  }

  // Load course info to get course name
  private loadCourseInfo() {
    if (!this.courseId) return;

    this.apiService.get(`/courses/${this.courseId}`).subscribe({
      next: (course: any) => {
        this.currentCourseName = course.title || 'Khóa học';
      },
      error: (err) => {
        this.currentCourseName = 'Khóa học';
      }
    });
  }

  // Load course content directly without fetching course list first
  loadUserCourses() {
    this.loading = true;

    // For student, directly load course content if courseId is available
    if (this.courseId) {
      this.loadVideos(); // Auto load videos
      this.loadCourseInfo(); // Load course info to get course name
      this.loading = false;
    } else {
      this.loading = false;
    }
  }

  // Load videos when course is selected
  onCourseChange() {
    if (this.courseId) {
      this.loadVideos();
    }
  }

  // Load videos theo courseId với authentication
  loadVideos() {
    if (!this.courseId) return;

    this.loading = true;

    // For students, only load published videos
    const publishedOnly = this.sessionService.isStudent();

    this.apiService.getVideosByCourse(this.courseId, publishedOnly).subscribe({
      next: data => {
        // Always apply client-side filtering for students as additional safety measure
        if (publishedOnly) {
          this.videos = data.filter(video => {
            const isPublished = video.published === true || video.publish === true || video.status === 'published';
            return isPublished;
          });
        } else {
          this.videos = data;
        }

        this.loading = false;

        if (this.videos.length > 0) {
          // Phát video đầu tiên của khóa học
          this.playVideo(this.videos[0]);
          this.hasNoVideos = false; // Đặt lại trạng thái không có video
        } else {
          // Hiển thị thông báo khi không có video
          this.showNoVideosMessage();
          this.hasNoVideos = true; // Đánh dấu là không có video
        }
      },
      error: err => {
        this.loading = false;

        // If publishedOnly request fails, try fallback for students
        if (publishedOnly && this.courseId) {
          this.apiService.getVideosByCourse(this.courseId, false).subscribe({
            next: allVideos => {
              // Filter published videos client-side - check multiple possible fields
              this.videos = allVideos.filter(video => {
                const isPublished = video.published === true || video.publish === true || video.status === 'published';
                return isPublished;
              });
              this.loading = false;

              if (this.videos.length > 0) {
                this.playVideo(this.videos[0]);
                this.hasNoVideos = false;
              } else {
                this.showNoVideosMessage();
                this.hasNoVideos = true;
              }
            },
            error: fallbackErr => {
              this.loading = false;
              if (fallbackErr.status === 401) {
                this.showAlert('Bạn cần đăng nhập để xem video', 'warning');
              } else if (fallbackErr.status === 403) {
                this.showAlert('Bạn không có quyền truy cập khóa học này', 'error');
              } else {
                this.showAlert('Không thể tải danh sách video. Vui lòng thử lại!', 'error');
              }
            }
          });
        } else {
          // Handle other errors normally
          if (err.status === 401) {
            this.showAlert('Bạn cần đăng nhập để xem video', 'warning');
          } else if (err.status === 403) {
            this.showAlert('Bạn không có quyền truy cập khóa học này', 'error');
          } else {
            this.showAlert('Không thể tải danh sách video. Vui lòng thử lại!', 'error');
          }
        }
      }
    });
  }

  // Load specific video by videoId and play it directly
  loadSpecificVideo(videoId: number, moduleId?: number | null) {
    if (!this.courseId) return;

    this.loading = true;

    // For students, only load published videos
    const publishedOnly = this.sessionService.isStudent();

    this.apiService.getVideosByCourse(this.courseId, publishedOnly).subscribe({
      next: data => {
        // Always apply client-side filtering for students as additional safety measure
        if (publishedOnly) {
          this.videos = data.filter(video => {
            const isPublished = video.published === true || video.publish === true || video.status === 'published';
            return isPublished;
          });
        } else {
          this.videos = data;
        }

        // Find and play the specific video
        const targetVideo = this.videos.find(video => video.videoId === videoId);
        if (targetVideo) {
          this.playVideo(targetVideo);
          this.hasNoVideos = false;
        } else {
          this.showAlert('Video không tìm thấy hoặc chưa được công bố', 'warning');
          // If specific video not found, play first available video as fallback
          if (this.videos.length > 0) {
            this.playVideo(this.videos[0]);
            this.hasNoVideos = false;
          } else {
            this.showNoVideosMessage();
            this.hasNoVideos = true;
          }
        }

        this.loading = false;
      },
      error: err => {
        this.loading = false;
        this.showAlert('Không thể tải video. Vui lòng thử lại!', 'error');
      }
    });
  }

  toggleDropdown() {
    this.dropdownOpen = !this.dropdownOpen;
  }

  playVideo(video: any, event?: Event) {
    if (event) event.preventDefault();
    this.currentVideo = video;

    // Kiểm tra videoId hợp lệ
    if (!video.videoId) {
      this.showAlert('Không thể phát video: ID video không hợp lệ', 'error');
      return;
    }

    // Sử dụng API stream với authentication
    this.apiService.streamVideo(video.videoId).subscribe({
      next: (blob) => {
        // Check if video player is available
        if (!this.videoPlayer?.nativeElement) {
          this.showAlert('Không thể phát video: Trình phát video không khả dụng', 'error');
          return;
        }

        // Cleanup blob URL cũ trước khi tạo mới
        if (this.currentBlobUrl) {
          URL.revokeObjectURL(this.currentBlobUrl);
        }

        const url = URL.createObjectURL(blob);
        this.currentBlobUrl = url; // Lưu blob URL để cleanup sau

        this.videoPlayer.nativeElement.src = url;
        this.videoPlayer.nativeElement.load();
        this.videoPlayer.nativeElement.play();

        // Thêm giới hạn tua video không quá 2 phút
        this.addVideoSeekLimitation();

        // Add video progress tracking for students
        if (this.sessionService.isStudent()) {
          this.addVideoProgressTracking(video);
        }

        // Reset tổng thời gian tua cho video mới
        this.totalSeekTime = 0;
      },
      error: (err) => {
        let errorMessage = 'Không thể tải video';

        if (err.status === 401) {
          errorMessage = 'Bạn cần đăng nhập để xem video';
        } else if (err.status === 403) {
          errorMessage = 'Bạn không có quyền xem video này';
        } else if (err.status === 404) {
          errorMessage = 'Video không tồn tại';
        } else if (err.status === 0) {
          errorMessage = 'Không thể kết nối tới server. Vui lòng kiểm tra kết nối mạng';
        } else {
          errorMessage = `Lỗi server: ${err.status} - ${err.message || 'Unknown error'}`;
        }

        this.showAlert(errorMessage, 'error');
        console.log('Video request details:', {
          videoId: video.videoId,
          url: `/api/videos/stream/${video.videoId}`,
          token: localStorage.getItem('token')?.substring(0, 20) + '...',
          status: err.status,
          error: err.error
        });
      }
    });
  }

  private addVideoSeekLimitation() {
    if (!isPlatformBrowser(this.platformId)) return;

    if (!this.videoPlayer?.nativeElement) {
      return;
    }

    const video = this.videoPlayer.nativeElement;
    let lastTime = 0;
    let isUserSeeking = false;

    // Theo dõi thời gian phát để phát hiện tua
    video.addEventListener('timeupdate', () => {
      if (!isUserSeeking) {
        lastTime = video.currentTime;
      }
    });

    // Bắt đầu tua
    video.addEventListener('seeking', () => {
      isUserSeeking = true;
      const currentTime = video.currentTime;
      const timeDifference = Math.abs(currentTime - lastTime);

      // Nếu nhảy quá 1 giây thì coi là tua (không phải pause/play bình thường)
      if (timeDifference > 1) {
        this.totalSeekTime += timeDifference;

        // Kiểm tra vượt giới hạn
        if (this.totalSeekTime > this.maxTotalSeekTime) {
          video.currentTime = lastTime; // Quay về vị trí trước đó
          this.totalSeekTime -= timeDifference; // Trừ lại thời gian vừa tua
          this.showAlert(`Bạn đã sử dụng hết ${this.maxTotalSeekTime/60} phút tua video. Không thể tua thêm!`, 'warning');
        } else {
          lastTime = currentTime;
          // Hiển thị cảnh báo khi còn 30s
          const remainingSeekTime = this.maxTotalSeekTime - this.totalSeekTime;
          if (remainingSeekTime <= 30 && remainingSeekTime > 0) {
            this.showAlert(`Cảnh báo: Chỉ còn ${remainingSeekTime.toFixed(0)} giây tua video!`, 'warning');
          }
        }
      }
    });

    // Kết thúc tua
    video.addEventListener('seeked', () => {
      isUserSeeking = false;
    });
  }

  private addVideoProgressTracking(video: any) {
    if (!isPlatformBrowser(this.platformId)) return;

    if (!this.videoPlayer?.nativeElement) {
      return;
    }

    const videoElement = this.videoPlayer.nativeElement;
    let lastUpdateTime = 0;
    const updateInterval = 10; // Update progress every 10 seconds

    videoElement.addEventListener('timeupdate', () => {
      const currentTime = videoElement.currentTime;
      const duration = videoElement.duration;

      // Only update progress every 10 seconds to avoid too many API calls
      if (currentTime - lastUpdateTime >= updateInterval || currentTime === 0) {
        lastUpdateTime = currentTime;

        if (duration && currentTime > 0) {
          this.updateVideoProgress(video, currentTime, duration);
        }
      }
    });

    // Track when video ends
    videoElement.addEventListener('ended', () => {
      const duration = videoElement.duration;
      if (duration) {
        this.updateVideoProgress(video, duration, duration);
      }
    });
  }

  private updateVideoProgress(video: any, currentTime: number, duration: number) {
    if (!video.videoId) return;

    this.moduleContentService.updateVideoWatchProgress(video.videoId, currentTime, duration).subscribe({
      next: (response: any) => {
        const watchedPercentage = (currentTime / duration) * 100;

        // Update local video object
        video.watchedPercentage = watchedPercentage;
        video.isCompleted = watchedPercentage >= 90;

        if (video.isCompleted && watchedPercentage >= 99) {
          this.showAlert('Bạn đã hoàn thành video này!', 'success');
        }
      },
      error: (err: any) => {
      }
    });
  }

  clearVideos() {
    const shouldClear = isPlatformBrowser(this.platformId)
      ? confirm('Bạn có chắc chắn muốn xoá tất cả video đã tải lên (chỉ ở giao diện)?')
      : true; // Default to true in SSR

    if (shouldClear) {
      // Cleanup blob URL trước khi clear
      if (this.currentBlobUrl) {
        URL.revokeObjectURL(this.currentBlobUrl);
        this.currentBlobUrl = null;
      }

      this.videos = [];
      this.currentVideo = null;

      // Clear video player if it exists
      if (this.videoPlayer?.nativeElement) {
        this.videoPlayer.nativeElement.src = '';
      }
    }
  }

  // Profile component event handlers
  onProfileUpdate() {
    // Handle profile update - could navigate to profile page or refresh data
  }

  onLogout() {
    // Handle logout through session service
    this.sessionService.logout();
  }
}
