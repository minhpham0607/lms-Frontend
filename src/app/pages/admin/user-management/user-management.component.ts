import { Component, OnInit, Inject, PLATFORM_ID, HostListener } from '@angular/core';
import { UserService, User } from '../../../services/user.service';
import { NotificationService } from '../../../services/notification.service';
import { SessionService } from '../../../services/session.service';
import { NotificationComponent } from '../../../components/notification/notification.component';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { SidebarWrapperComponent } from '../../../components/sidebar-wrapper/sidebar-wrapper.component';
import { ProfileComponent } from '../../../components/profile/profile.component';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-user-management',
  standalone: true,
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.scss'],
  imports: [CommonModule, SidebarWrapperComponent, ProfileComponent, FormsModule, NotificationComponent]
})
export class UserManagementComponent implements OnInit {
  users: User[] = [];
  filteredUsers: User[] = [];
  pagedUsers: User[] = [];
  searchTerm: string = '';
  editingUser: User | null = null;
  selectedAvatarFile: File | null = null;
  
  // Loading states
  isLoading: boolean = false;
  isUpdating: boolean = false;
  isCvLoading: boolean = false;

  // Phân trang
  currentPage: number = 1;
  pageSize: number = 10;
  totalPages: number = 1;

  // Filter properties
  activeFilter: string = 'all'; // 'all', 'student', 'instructor'

  // CV viewer
  viewingCvUrl: string | null = null;

  // Profile component properties
  username: string = '';
  avatarUrl: string = '';
  userRole: string = '';

  constructor(
    private userService: UserService,
    private notificationService: NotificationService,
    private sessionService: SessionService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    this.initializeUserProfile();
    this.loadUsers();
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      if (this.editingUser) {
        this.cancelEdit();
      }
      if (this.viewingCvUrl) {
        this.closeCvViewer();
      }
    }
  }

  loadUsers(): void {
    this.isLoading = true;
    
    // Kiểm tra thông tin user hiện tại
    const userInfo = this.userService.getCurrentUserInfo();
    
    // Kiểm tra token trong localStorage
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
        } catch (e) {
          // Invalid token format
        }
      }
    }
    
    if (userInfo.role !== 'admin') {
      this.notificationService.error('Quyền truy cập bị từ chối', 'Bạn không có quyền truy cập tính năng này.');
      this.isLoading = false;
      return;
    }

    this.userService.getUsers().subscribe({
      next: data => {
        // Sort by userId descending (newest registration first)
        this.users = data.sort((a, b) => b.userId - a.userId);
        this.applyFilters();
        this.isLoading = false;
      },
      error: err => {
        this.isLoading = false;
        if (err.status === 403) {
          this.notificationService.error('Không có quyền truy cập', 'Vui lòng đăng nhập lại.');
        } else if (err.status === 401) {
          this.notificationService.error('Phiên đăng nhập hết hạn', 'Vui lòng đăng nhập lại.');
        } else {
          this.notificationService.error('Lỗi tải dữ liệu', 'Lỗi khi tải danh sách người dùng: ' + (err.error?.message || err.message));
        }
      }
    });
  }

  applyFilters(): void {
    const keyword = this.searchTerm.trim().toLowerCase();
    this.filteredUsers = this.users.filter(user => {
      const matchesSearch = !keyword || 
        user.username.toLowerCase().includes(keyword) ||
        user.email.toLowerCase().includes(keyword) ||
        user.fullName.toLowerCase().includes(keyword);
      
      const matchesRole = this.activeFilter === 'all' || user.role === this.activeFilter;
      
      return matchesSearch && matchesRole;
    });
    
    // Sort filtered results by userId descending (newest first)
    this.filteredUsers.sort((a, b) => b.userId - a.userId);
    
    this.currentPage = 1;
    this.updatePagination();
  }

  onSearch(): void {
    this.applyFilters();
  }

  filterByRole(role: string): void {
    this.activeFilter = role;
    this.applyFilters();
  }

  showAllUsers(): void {
    this.activeFilter = 'all';
    this.applyFilters();
  }

  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredUsers.length / this.pageSize) || 1;
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    this.pagedUsers = this.filteredUsers.slice(start, end);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.updatePagination();
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  startEdit(user: User): void {
    const { password, ...userWithoutPassword } = user;
    this.editingUser = { ...userWithoutPassword, password: '' };
    this.selectedAvatarFile = null;
  }

  cancelEdit(): void {
    this.editingUser = null;
    this.selectedAvatarFile = null;
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedAvatarFile = input.files[0];
    }
  }

  updateUser(): void {
    if (!this.editingUser) return;

    this.isUpdating = true;
    const formData = new FormData();
    formData.append('username', this.editingUser.username);
    formData.append('email', this.editingUser.email);
    formData.append('fullName', this.editingUser.fullName);
    formData.append('role', this.editingUser.role);
    formData.append('isVerified', String(this.editingUser.verified));

    // Improved password handling
    const password = this.editingUser.password?.trim();
    if (password && password.length > 0) {
      formData.append('password', password);
    } else {
      // Password field empty - no password update
    }

    if (this.editingUser.cvUrl) {
      formData.append('cvUrl', this.editingUser.cvUrl);
    }

    if (this.selectedAvatarFile) {
      formData.append('avatar', this.selectedAvatarFile);
    }

    this.userService.updateUserWithForm(this.editingUser.userId, formData).subscribe({
      next: (response) => {
        this.notificationService.success('Cập nhật thành công', 'Thông tin người dùng đã được cập nhật.');
        this.editingUser = null;
        this.selectedAvatarFile = null;
        this.isUpdating = false;
        this.loadUsers();
      },
      error: err => {
        this.isUpdating = false;
        this.notificationService.error('Cập nhật thất bại', err.error?.message || err.message || 'Có lỗi xảy ra khi cập nhật.');
      }
    });
  }

  // ✅ New method: Quick update verification status
  updateVerificationStatus(user: User, verified: boolean): void {
    const formData = new FormData();
    formData.append('username', user.username);
    formData.append('email', user.email);
    formData.append('fullName', user.fullName);
    formData.append('role', user.role);
    formData.append('isVerified', String(verified));
    
    if (user.cvUrl) {
      formData.append('cvUrl', user.cvUrl);
    }

    this.userService.updateUserWithForm(user.userId, formData).subscribe({
      next: (response) => {
        // Update the user in the local arrays
        const userIndex = this.users.findIndex(u => u.userId === user.userId);
        if (userIndex !== -1) {
          this.users[userIndex].verified = verified;
        }
        
        const filteredIndex = this.filteredUsers.findIndex(u => u.userId === user.userId);
        if (filteredIndex !== -1) {
          this.filteredUsers[filteredIndex].verified = verified;
        }
        
        const pagedIndex = this.pagedUsers.findIndex(u => u.userId === user.userId);
        if (pagedIndex !== -1) {
          this.pagedUsers[pagedIndex].verified = verified;
        }
        
        alert(`${verified ? 'Phê duyệt' : 'Hủy phê duyệt'} thành công cho ${user.username}!`);
      },
      error: err => {
        // Revert the checkbox if update failed
        user.verified = !verified;
        alert('Cập nhật trạng thái thất bại: ' + (err.error?.message || err.message));
      }
    });
  }

  // Event handler for checkbox toggle
  onVerificationToggle(user: User, event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target) {
      this.updateVerificationStatus(user, target.checked);
    }
  }

  confirmDelete(user: User): void {
    const confirmed = confirm(`Xác nhận xoá người dùng "${user.username}"?`);
    if (confirmed) {
      this.userService.deleteUserById(user.userId).subscribe({
        next: (res) => {
          alert(res.message);
          this.filteredUsers = this.filteredUsers.filter(u => u.userId !== user.userId);
          this.updatePagination();
          this.editingUser = null;
        },
        error: (err) => {
          alert(err.error?.message || 'Lỗi khi xoá người dùng');
        }
      });
    }
  }

  openCvViewer(cvUrl: string): void {
    this.isCvLoading = true;
    this.viewingCvUrl = `http://localhost:8080/${cvUrl}`;
    
    // Simulate loading state for iframe
    setTimeout(() => {
      this.isCvLoading = false;
    }, 1000);
  }

  closeCvViewer(): void {
    this.viewingCvUrl = null;
    this.isCvLoading = false;
  }

  // Add getter methods for template binding
  get verifiedUsersCount(): number {
    return this.filteredUsers.filter(u => u.verified).length;
  }

  get unverifiedUsersCount(): number {
    return this.filteredUsers.filter(u => !u.verified).length;
  }

  getVisiblePages(): number[] {
    const pages: number[] = [];
    const start = Math.max(1, this.currentPage - 2);
    const end = Math.min(this.totalPages, this.currentPage + 2);
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  // Profile component methods
  private initializeUserProfile(): void {
    const userInfo = this.userService.getCurrentUserInfo();
    this.username = userInfo.username;
    this.userRole = userInfo.role; // Giữ nguyên role gốc
    this.avatarUrl = userInfo.avatarUrl;
  }

  // Format role để hiển thị (chữ cái đầu viết hoa)
  getDisplayRole(role: string): string {
    const cleanRole = role.replace('ROLE_', '').toLowerCase();
    return cleanRole.charAt(0).toUpperCase() + cleanRole.slice(1);
  }

  onProfileUpdate(): void {
    // Profile update requested
  }

  onLogout(): void {
    // SessionService sẽ xử lý việc hiển thị notification và chuyển hướng
    this.sessionService.logout();
  }
}

// Add alias export for backward compatibility
export { UserManagementComponent as UsersComponent };
