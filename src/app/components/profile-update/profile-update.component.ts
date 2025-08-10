import { Component, OnInit, EventEmitter, Output, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UserService, User } from '../../services/user.service';
import { AvatarService } from '../../services/avatar.service';
import { SessionService } from '../../services/session.service';

@Component({
  selector: 'app-profile-update',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './profile-update.component.html',
  styleUrls: ['./profile-update.component.scss']
})
export class ProfileUpdateComponent implements OnInit {
  @Output() closeModal = new EventEmitter<void>();
  @Output() updateSuccess = new EventEmitter<User>();

  profileForm: FormGroup;
  loading = false;
  selectedFile: File | null = null;
  imagePreview: string | null = null;
  currentUser: User | null = null;
  userId: number | null = null;

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private sessionService: SessionService,
    private avatarService: AvatarService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.profileForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      fullName: ['', [Validators.required, Validators.minLength(2)]],
      password: [''], // Optional field for password update
      confirmPassword: ['']
    });
  }

  ngOnInit() {
    this.loadCurrentUser();
  }

  loadCurrentUser() {
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          this.userId = payload.id || payload.userId || payload.sub;
          // ...existing code...
          // KHÔNG lấy avatar từ token, chỉ lấy từ API
          this.currentUser = {
            userId: this.userId || 0,
            username: payload.sub || '',
            email: payload.email || '',
            fullName: payload.fullName || payload.sub || '',
            role: payload.role || 'student',
            verified: payload.verified || false,
            avatarUrl: null // luôn null để load từ API
          };

          // Luôn load từ API để lấy avatar mới nhất
          this.loadUserFromAPI();
        } catch (error) {
          console.error('❌ Error decoding token:', error);
          this.showAlert('Lỗi xác thực. Vui lòng đăng nhập lại.');
        }
      } else {
        console.error('❌ No token found');
        this.showAlert('Không tìm thấy token. Vui lòng đăng nhập lại.');
      }
    }
  }

  loadUserFromAPI() {
    if (this.userId) {
      this.userService.getUserById(this.userId).subscribe({
        next: (user: User) => {
          // Update form with fresh data
          this.profileForm.patchValue({
            username: user.username || '',
            email: user.email || '',
            fullName: user.fullName || ''
          });
          
          // Update current user with fresh data including avatar
          this.currentUser = {
            userId: user.userId || 0,
            username: user.username || '',
            email: user.email || '',
            fullName: user.fullName || '',
            role: user.role || 'student',
            verified: user.verified || false,
            avatarUrl: user.avatarUrl || null
          };
          
          console.log('✅ Loaded user from API with avatar:', this.currentUser.avatarUrl);
        },
        error: (error: any) => {
          console.error('Error loading user from API:', error);
          // Keep token data as fallback
        }
      });
    }
  }

  onFileSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      this.selectedFile = target.files[0];
      
      // Preview image
      const reader = new FileReader();
      reader.onload = (e) => {
        this.imagePreview = e.target?.result as string;
      };
      reader.readAsDataURL(this.selectedFile);
    }
  }

  onSubmit() {
    if (this.profileForm.invalid) {
      this.markFormGroupTouched(this.profileForm);
      return;
    }

    if (!this.userId) {
      this.showAlert('Không tìm thấy thông tin người dùng');
      return;
    }

    // Check password confirmation
    const password = this.profileForm.get('password')?.value;
    const confirmPassword = this.profileForm.get('confirmPassword')?.value;
    
    if (password && password !== confirmPassword) {
      this.showAlert('Mật khẩu xác nhận không khớp');
      return;
    }

    // Get form values
    const newEmail = this.profileForm.get('email')?.value;
    const newUsername = this.profileForm.get('username')?.value;
    
    // Check if email/username changed and warn user
    if (this.currentUser) {
      if (newEmail !== this.currentUser.email || newUsername !== this.currentUser.username) {
        const changed = [];
        if (newEmail !== this.currentUser.email) changed.push('email');
        if (newUsername !== this.currentUser.username) changed.push('username');
        
        const confirmMessage = `Bạn đang thay đổi ${changed.join(' và ')}. Nếu ${changed.join('/')} mới đã được sử dụng, việc cập nhật sẽ thất bại. Bạn có muốn tiếp tục?`;
        
        if (!confirm(confirmMessage)) {
          return;
        }
      }
    }

    this.loading = true;
    const formData = new FormData();
    
    formData.append('username', this.profileForm.get('username')?.value || '');
    formData.append('email', this.profileForm.get('email')?.value || '');
    formData.append('fullName', this.profileForm.get('fullName')?.value || '');
    
    // ✅ Xử lý role: loại bỏ prefix "ROLE_" nếu có
    let role = this.currentUser?.role || 'student';
    if (role.startsWith('ROLE_')) {
      role = role.substring(5); // Loại bỏ "ROLE_"
    }
    formData.append('role', role);
    
    // Only add password if it's provided
    if (password && password.trim()) {
      formData.append('password', password);
    }

    // Add avatar file if selected
    if (this.selectedFile) {
      formData.append('avatar', this.selectedFile);
    }

    console.log('🔄 Updating user with ID:', this.userId);
    console.log('📝 Form data being sent:', {
      username: formData.get('username'),
      email: formData.get('email'),
      fullName: formData.get('fullName'),
      role: formData.get('role'),
      hasAvatar: !!this.selectedFile,
      hasPassword: !!password
    });

    this.userService.updateUserWithForm(this.userId, formData).subscribe({
      next: (response: any) => {
        console.log('✅ Update successful:', response);
        this.showAlert('Cập nhật hồ sơ thành công!');

        // Nếu backend trả về token mới, cập nhật lại token để avatarUrl mới được lấy từ token
        if (response.token) {
          localStorage.setItem('token', response.token);
        }

        // Reload user data to get updated info including avatar
        if (this.userId) {
          this.userService.getUserById(this.userId).subscribe({
            next: (updatedUser: User) => {
              console.log('✅ Reloaded user data:', updatedUser);

              // Reset preview và file đã chọn trước khi cập nhật currentUser
              this.imagePreview = null;
              this.selectedFile = null;

              // Update current user với dữ liệu mới nhất (avatar mới)
              this.currentUser = updatedUser;

              // Force Angular cập nhật lại giao diện avatar
              setTimeout(() => {}, 0);

              this.updateSuccess.emit(updatedUser);
              this.closeModal.emit();
              this.loading = false;
            },
            error: (error: any) => {
              console.error('❌ Error loading updated user:', error);
              // Still emit success even if reload fails
              this.updateSuccess.emit();
              this.closeModal.emit();
              this.loading = false;
            }
          });
        } else {
          this.updateSuccess.emit();
          this.closeModal.emit();
          this.loading = false;
        }
      },
      error: (error: any) => {
        console.error('❌ Update error:', error);
        console.error('❌ Error details:', {
          status: error.status,
          statusText: error.statusText,
          message: error.error?.message,
          url: error.url
        });
        
        let errorMessage = 'Lỗi không xác định';
        if (error.status === 401) {
          errorMessage = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
        } else if (error.status === 403) {
          errorMessage = 'Bạn không có quyền cập nhật thông tin này.';
        } else if (error.status === 404) {
          errorMessage = 'Không tìm thấy người dùng.';
        } else if (error.status === 400) {
          errorMessage = error.error?.message || 'Dữ liệu không hợp lệ.';
        } else if (error.status === 500) {
          // Handle specific database constraint errors
          const serverMessage = error.error?.message || '';
          if (serverMessage.includes('UK6dotkott2kjsp8vw4d0m25fb7') || serverMessage.includes('email')) {
            errorMessage = 'Email này đã được sử dụng bởi người dùng khác. Vui lòng chọn email khác.';
          } else if (serverMessage.includes('username') || serverMessage.includes('unique')) {
            errorMessage = 'Tên đăng nhập này đã được sử dụng. Vui lòng chọn tên khác.';
          } else {
            errorMessage = 'Lỗi server. Vui lòng thử lại sau.';
          }
        } else if (error.error?.message) {
          errorMessage = error.error.message;
        }
        
        this.showAlert('Cập nhật hồ sơ thất bại: ' + errorMessage);
        this.loading = false;
      }
    });
  }

  private markFormGroupTouched(formGroup: FormGroup) {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  private showAlert(message: string) {
    if (isPlatformBrowser(this.platformId)) {
      alert(message);
    } else {
      console.log('Alert (SSR):', message);
    }
  }

  cancel() {
    this.closeModal.emit();
  }

  onAvatarError(event: any) {
    // Fallback to a reliable default avatar
    event.target.src = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face';
  }

  getAvatarUrl(): string {
    // Chỉ lấy avatar từ currentUser.avatarUrl (không lấy từ token)
    if (this.imagePreview && this.selectedFile) {
      return this.imagePreview;
    }
    if (this.currentUser?.avatarUrl) {
      // Thêm query string ngẫu nhiên để tránh cache
      const processedUrl = this.avatarService.getValidAvatarUrl(this.currentUser.avatarUrl);
      const bustCacheUrl = processedUrl + '?v=' + Date.now();
      return bustCacheUrl;
    }
    return this.avatarService.getDefaultAvatarUrl();
  }
}
    