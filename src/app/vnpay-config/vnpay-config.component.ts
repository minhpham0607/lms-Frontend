import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaymentService } from '../services/payment.service';

@Component({
  selector: 'app-vnpay-config',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="vnpay-config">
      <h3>VNPay Configuration</h3>
      <div *ngIf="config" class="config-info">
        <p><strong>TMN Code:</strong> {{ config.tmnCode }}</p>
        <p><strong>Pay URL:</strong> {{ config.payUrl }}</p>
        <p><strong>Return URL:</strong> {{ config.returnUrl }}</p>
        <p><strong>Status:</strong> 
          <span [class]="config.status === 'active' ? 'text-success' : 'text-danger'">
            {{ config.status }}
          </span>
        </p>
      </div>
      <div *ngIf="error" class="alert alert-danger">
        {{ error }}
      </div>
    </div>
  `,
  styles: [`
    .vnpay-config {
      padding: 20px;
      border: 1px solid #ddd;
      border-radius: 8px;
      margin: 20px 0;
    }
    .config-info p {
      margin: 10px 0;
    }
    .text-success {
      color: #28a745;
    }
    .text-danger {
      color: #dc3545;
    }
  `]
})
export class VnpayConfigComponent implements OnInit {
  config: any = null;
  error: string = '';

  constructor(private paymentService: PaymentService) {}

  ngOnInit() {
    this.loadConfig();
  }

  async loadConfig() {
    try {
      this.config = await this.paymentService.getVNPayConfig().toPromise();
    } catch (error: any) {
      this.error = 'Failed to load VNPay configuration';
      console.error('Error loading VNPay config:', error);
    }
  }
}