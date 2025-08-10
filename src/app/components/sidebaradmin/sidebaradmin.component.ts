import { Component, OnInit, ViewEncapsulation, HostListener, ElementRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { SessionService } from '../../services/session.service';

@Component({
  selector: 'app-sidebaradmin',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebaradmin.component.html',
  styleUrls: ['./sidebaradmin.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SidebaradminComponent implements OnInit {
  
  currentRoute: string = '';
  reportsExpanded: boolean = false;
  sidebarExpanded: boolean = false;

  constructor(
    private router: Router,
    private sessionService: SessionService,
    private elementRef: ElementRef
  ) {}

  ngOnInit() {
    // Lắng nghe sự thay đổi route để cập nhật active state
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.currentRoute = event.url;
      console.log('Admin Sidebar - Route changed to:', this.currentRoute);
      
      // Auto expand reports if on a reports sub-route
      this.updateReportsExpanded();
    });

    // Set initial route
    this.currentRoute = this.router.url;
    console.log('Admin Sidebar - Initial route:', this.currentRoute);
    
    // Auto expand reports if starting on a reports sub-route
    this.updateReportsExpanded();
  }

  private updateReportsExpanded() {
    if (this.currentRoute.includes('/registration-statistics') || 
        this.currentRoute.includes('/course-statistics') || 
        this.currentRoute.includes('/participant-statistics') ||
        this.currentRoute.includes('/reports')) {
      this.reportsExpanded = true;
    }
  }

  navigateTo(route: string, event?: Event) {
    // Check if we're on mobile and sidebar is collapsed
    if (window.innerWidth <= 768 && !this.sidebarExpanded) {
      // First click: expand sidebar
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      this.sidebarExpanded = true;
      return;
    }
    
    // Second click or desktop: navigate
    this.router.navigate([route]);
  }

  toggleReports(event?: Event) {
    // Check if we're on mobile and sidebar is collapsed
    if (window.innerWidth <= 768 && !this.sidebarExpanded) {
      // First click: expand sidebar
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      this.sidebarExpanded = true;
      return;
    }
    
    // Không cho phép đóng dropdown nếu đang ở trong sub-routes
    if (this.hasActiveReportsChild() && this.reportsExpanded) {
      return; // Không thể đóng khi đang active sub-route
    }
    this.reportsExpanded = !this.reportsExpanded;
  }

  isActiveRoute(route: string): boolean {
    const isActive = this.currentRoute === route || this.currentRoute.startsWith(route + '/');
    if (route === '/admin/dashboard') {
      console.log('Admin Dashboard active check:', {
        currentRoute: this.currentRoute,
        route: route,
        isActive: isActive
      });
    }
    return isActive;
  }

  isReportsActive(): boolean {
    return this.currentRoute === '/reports';
  }

  hasActiveReportsChild(): boolean {
    return this.currentRoute.includes('/registration-statistics') || 
           this.currentRoute.includes('/course-statistics') || 
           this.currentRoute.includes('/participant-statistics');
  }

  toggleSidebar() {
    this.sidebarExpanded = !this.sidebarExpanded;
  }

  onSidebarMouseEnter() {
    if (window.innerWidth <= 768) {
      this.sidebarExpanded = true;
    }
  }

  onSidebarMouseLeave() {
    if (window.innerWidth <= 768) {
      this.sidebarExpanded = false;
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    // Chỉ áp dụng trên mobile
    if (window.innerWidth <= 768 && this.sidebarExpanded) {
      const target = event.target as Element;
      // Nếu click bên ngoài sidebar, ẩn sidebar
      if (!this.elementRef.nativeElement.contains(target)) {
        this.sidebarExpanded = false;
      }
    }
  }

  logout(event?: Event) {
    // Check if we're on mobile and sidebar is collapsed
    if (window.innerWidth <= 768 && !this.sidebarExpanded) {
      // First click: expand sidebar
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      this.sidebarExpanded = true;
      return;
    }
    
    // Second click or desktop: logout
    this.sessionService.logout();
  }
}
