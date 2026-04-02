import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'shop-loading-spinner',
  imports: [CommonModule],
  template: `
    <div class="spinner-container">
      <div class="spinner"></div>
      <p>Loading...</p>
    </div>
  `,
  styles: [`
    .spinner-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid var(--color-gray-200, #e5e7eb);
      border-top-color: var(--color-primary, #4f46e5);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    p {
      margin-top: 16px;
      color: var(--color-gray-500, #6b7280);
      font-size: 1rem;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingSpinnerComponent {}