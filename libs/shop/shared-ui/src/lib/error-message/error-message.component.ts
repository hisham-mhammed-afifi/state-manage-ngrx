import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'shop-error-message',
  imports: [CommonModule],
  template: `
    <div class="error-container">
      <div class="error-icon">⚠️</div>
      <h3>{{ title() || 'Oops! Something went wrong' }}</h3>
      <p>{{ message() || 'An unexpected error occurred. Please try again later.' }}</p>
      @if (showRetry()) {
        <button class="retry-button" (click)="retry.emit()">
          Try Again
        </button>
      }
    </div>
  `,
  styles: [`
    .error-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px;
      text-align: center;
      background: var(--color-surface, #fff);
      border-radius: var(--radius-lg, 8px);
      border: 1px solid var(--color-border, #e5e7eb);
    }

    .error-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    h3 {
      margin: 0 0 8px 0;
      font-size: 1.5rem;
      color: var(--color-gray-900, #111827);
    }

    p {
      margin: 0 0 24px 0;
      color: var(--color-gray-500, #6b7280);
      font-size: 1rem;
      max-width: 400px;
    }

    .retry-button {
      background: var(--color-primary, #4f46e5);
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: var(--radius-md, 6px);
      font-size: 1rem;
      cursor: pointer;
      font-family: inherit;
      transition: background var(--transition-fast, 150ms ease);
    }

    .retry-button:hover {
      background: var(--color-primary-hover, #4338ca);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorMessageComponent {
  readonly title = input<string>();
  readonly message = input<string>();
  readonly showRetry = input(true);
  readonly retry = output<void>();
}