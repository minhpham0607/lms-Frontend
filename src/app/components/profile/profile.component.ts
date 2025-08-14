import { Component, Input, Output, EventEmitter, OnInit, Inject, PLATFORM_ID, HostListener, ElementRef } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { ProfileUpdateComponent } from '../profile-update/profile-update.component';
import { AvatarService } from '../../services/avatar.service';
import { UserService } from '../../services/user.service';
import { SessionService } from '../../services/session.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ProfileUpdateComponent],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  @Input() username: string = 'User';
  @Input() role: string = 'Student';
  @Input() avatarUrl: string = '';
  @Input() showNotifications: boolean = true;
  @Input() showMessages: boolean = true;

  @Output() profileUpdate = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();

  profileDropdownVisible = false;
  showProfileUpdateModal = false;

  constructor(
    private userService: UserService,
    private sessionService: SessionService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private avatarService: AvatarService,
    private elementRef: ElementRef
  ) {}

  ngOnInit() {
    // Thử lấy từ session trước
    const sessionAvatar = this.sessionService.getAvatarUrl();
    if (sessionAvatar && sessionAvatar !== 'assets/pictures/logocmc.png') {
      this.avatarUrl = sessionAvatar;
    }

    // Load user data từ API
    this.loadUserFromAPI();

    // Lấy userId từ token và gọi API lấy avatar
    let userId: number | null = null;
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          userId = payload.id || payload.userId || payload.sub;
        } catch (e) {
          userId = null;
        }
      }
    }
    if (userId) {
      this.fetchAvatarFromAPI();
    }
  }

  private loadUserFromAPI() {
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('token');
      if (token) {
        this.userService.getCurrentUser().subscribe({
          next: (user) => {
            this.username = user.fullName || user.username || this.username;
            this.role = user.role || this.role;

            if (user.avatarUrl) {
              const avatarUrl = this.avatarService.getValidAvatarUrl(user.avatarUrl);
              
              // Chỉ cập nhật nếu khác default
              if (avatarUrl !== this.avatarService.getDefaultAvatarUrl()) {
                this.avatarUrl = avatarUrl;
                this.sessionService.setAvatarUrl(this.avatarUrl);
              }
            } else {
              // Nếu chưa có avatar nào, dùng default
              if (!this.avatarUrl || this.avatarUrl === this.avatarService.getDefaultAvatarUrl()) {
                this.avatarUrl = this.avatarService.getDefaultAvatarUrl();
                this.sessionService.setAvatarUrl(this.avatarUrl);
              }
            }
          },
          error: (err) => {
            this.loadUserFromToken();
          }
        });
      } else {
        this.avatarUrl = this.avatarService.getDefaultAvatarUrl();
        this.sessionService.setAvatarUrl(this.avatarUrl);
      }
    }
  }

  private loadUserFromToken() {
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          this.username = payload.fullName || payload.sub || this.username;
          this.role = payload.role || this.role;

          if (payload.avatarUrl) {
            const avatarUrl = this.avatarService.getValidAvatarUrl(payload.avatarUrl);
            
            // Chỉ cập nhật nếu khác default
            if (avatarUrl !== this.avatarService.getDefaultAvatarUrl()) {
              this.avatarUrl = avatarUrl;
              this.sessionService.setAvatarUrl(this.avatarUrl);
            }
          }
        } catch (error) {
          this.avatarUrl = this.avatarService.getDefaultAvatarUrl();
          this.sessionService.setAvatarUrl(this.avatarUrl);
        }
      }
    }
  }

  private fetchAvatarFromAPI() {
    if (isPlatformBrowser(this.platformId)) {
      fetch('http://localhost:8080/api/users/profile', {
        credentials: 'include', // nếu cần gửi cookie/session
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        }
      })
        .then(res => res.json())
        .then(user => {
          if (user.avatarUrl) {
            const avatarUrl = this.avatarService.getValidAvatarUrl(user.avatarUrl) + '?v=' + Date.now();
            this.avatarUrl = avatarUrl;
            this.sessionService.setAvatarUrl(this.avatarUrl);
          } else {
            this.avatarUrl = this.avatarService.getDefaultAvatarUrl();
            this.sessionService.setAvatarUrl(this.avatarUrl);
          }
        })
        .catch(err => {
          this.avatarUrl = this.avatarService.getDefaultAvatarUrl();
          this.sessionService.setAvatarUrl(this.avatarUrl);
        });
    }
  }

  private getDefaultAvatar(): string {
    return this.avatarService.getDefaultAvatarUrl();
  }

  toggleProfileDropdown(event: Event) {
    event.stopPropagation();
    this.profileDropdownVisible = !this.profileDropdownVisible;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    // Check if click is outside the profile component
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.profileDropdownVisible = false;
    }
  }

  @HostListener('document:touchstart', ['$event'])
  onDocumentTouch(event: Event) {
    // Handle touch events for mobile
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.profileDropdownVisible = false;
    }
  }

  updateProfile() {
    this.profileDropdownVisible = false;
    this.showProfileUpdateModal = true;
  }

  closeProfileUpdateModal() {
    this.showProfileUpdateModal = false;
  }

  onProfileUpdateSuccess(updatedUser?: any) {
    this.showProfileUpdateModal = false;

    if (updatedUser?.avatarUrl) {
      const avatarUrl = this.avatarService.getValidAvatarUrl(updatedUser.avatarUrl);
      this.avatarUrl = avatarUrl;
      this.sessionService.setAvatarUrl(this.avatarUrl);
    }

    if (updatedUser) {
      this.username = updatedUser.fullName || updatedUser.username || this.username;
    }

    this.profileUpdate.emit();
  }

  onLogout() {
    this.profileDropdownVisible = false;
    this.logout.emit();
  }

  closeDropdown() {
    this.profileDropdownVisible = false;
  }

  getDisplayAvatar(): string {
    const storedAvatar = this.sessionService.getAvatarUrl();
    return storedAvatar && !storedAvatar.includes('logocmc.png')
      ? storedAvatar
      : this.avatarService.getDefaultAvatarUrl();
  }

  onAvatarError(event: any) {
    event.target.src = this.avatarService.getDefaultAvatarUrl();
  }
}