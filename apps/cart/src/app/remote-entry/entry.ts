import { Component, inject, computed } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { CartStore, CartItem } from '@org/feature-cart-state';
import { cartEvents } from '@org/state-core';
import { injectDispatch } from '@ngrx/signals/events';

@Component({
  selector: 'cart-cart-entry',
  standalone: true,
  imports: [CurrencyPipe],
  styles: [`
    :host { display: block; }
    h2 { margin: 0 0 1rem; color: var(--color-navy, #1e1b4b); }
    .state-loading {
      display: flex; flex-direction: column; align-items: center;
      gap: var(--space-3, 0.75rem); padding: 3rem; color: var(--color-gray-500, #6b7280);
    }
    .spinner {
      width: 36px; height: 36px;
      border: 3px solid var(--color-gray-200, #e5e7eb);
      border-top-color: var(--color-primary, #4f46e5);
      border-radius: 50%; animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .state-error {
      display: flex; flex-direction: column; align-items: center;
      gap: var(--space-2, 0.5rem); padding: 3rem; color: var(--color-error, #dc2626);
    }
    .state-error-icon { font-size: 2rem; }
    .empty { text-align: center; padding: 3rem; color: var(--color-gray-400, #9ca3af); }
    .empty-icon { font-size: 3rem; margin-bottom: 0.75rem; display: block; }
    .empty-text { font-size: var(--font-size-lg, 1.125rem); }
    .cart-layout { display: grid; grid-template-columns: 1fr 300px; gap: 1.5rem; }
    @media (max-width: 768px) { .cart-layout { grid-template-columns: 1fr; } }
    .cart-items { display: flex; flex-direction: column; gap: 0.5rem; }
    .cart-item {
      display: flex; align-items: center; gap: 1rem; padding: 0.75rem;
      border: 1px solid var(--color-border, #e5e7eb); border-radius: var(--radius-lg, 8px);
      background: var(--color-surface, #fff);
      transition: box-shadow var(--transition-fast, 150ms ease);
    }
    .cart-item:hover { box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,.05)); }
    .item-thumb { width: 64px; height: 64px; object-fit: cover; border-radius: var(--radius-md, 6px); }
    .item-info { flex: 1; }
    .item-title { font-weight: 600; font-size: var(--font-size-sm, 0.875rem); }
    .item-meta { font-size: var(--font-size-xs, 0.75rem); color: var(--color-gray-500, #6b7280); margin-top: 0.25rem; }
    .item-price { font-weight: 700; color: var(--color-primary, #4f46e5); }
    .item-discount { font-size: var(--font-size-xs, 0.75rem); color: var(--color-success, #16a34a); }
    .item-actions { text-align: right; }
    .btn-remove {
      background: var(--color-error-light, #fee2e2); border: none;
      color: var(--color-error, #dc2626); cursor: pointer;
      font-size: var(--font-size-xs, 0.75rem); padding: 0.375rem 0.625rem;
      border-radius: var(--radius-md, 6px); font-weight: 500; font-family: inherit;
      transition: background var(--transition-fast, 150ms ease);
    }
    .btn-remove:hover { background: #fecaca; }
    .summary-card {
      border: 1px solid var(--color-border, #e5e7eb); border-radius: var(--radius-lg, 8px);
      background: var(--color-surface, #fff); padding: 1.25rem; height: fit-content;
    }
    .summary-card h3 { margin: 0 0 1rem; font-size: var(--font-size-base, 1rem); }
    .summary-row { display: flex; justify-content: space-between; padding: 0.375rem 0; font-size: var(--font-size-sm, 0.875rem); }
    .summary-row.total {
      border-top: 2px solid var(--color-border, #e5e7eb);
      margin-top: 0.5rem; padding-top: 0.75rem; font-weight: 700; font-size: var(--font-size-base, 1rem);
    }
    .savings { color: var(--color-success, #16a34a); }
    .btn-clear {
      width: 100%; margin-top: 1rem; padding: 0.625rem;
      background: var(--color-error-light, #fee2e2); color: var(--color-error, #dc2626);
      border: none; border-radius: var(--radius-md, 6px); cursor: pointer;
      font-weight: 600; font-family: inherit;
      transition: background var(--transition-fast, 150ms ease);
    }
    .btn-clear:hover { background: #fecaca; }
    .confirm-clear {
      text-align: center; margin-top: 1rem; padding: 0.75rem;
      background: var(--color-error-bg, #fef2f2); border-radius: var(--radius-lg, 8px);
      animation: fade-in 200ms ease;
    }
    @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
    .confirm-clear span { font-size: var(--font-size-sm, 0.875rem); font-weight: 500; }
    .confirm-actions { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
    .btn-confirm-yes {
      flex: 1; padding: 0.5rem; background: var(--color-error, #dc2626); color: #fff;
      border: none; border-radius: var(--radius-md, 6px); cursor: pointer;
      font-weight: 600; font-size: var(--font-size-sm, 0.875rem); font-family: inherit;
      transition: background var(--transition-fast, 150ms ease);
    }
    .btn-confirm-yes:hover { background: #b91c1c; }
    .btn-confirm-no {
      flex: 1; padding: 0.5rem; background: var(--color-surface, #fff);
      border: 1px solid var(--color-border, #e5e7eb); border-radius: var(--radius-md, 6px);
      cursor: pointer; font-size: var(--font-size-sm, 0.875rem); font-family: inherit;
      transition: background var(--transition-fast, 150ms ease);
    }
    .btn-confirm-no:hover { background: var(--color-gray-50, #f9fafb); }
  `],
  template: `
    <h2>Shopping Cart</h2>

    @if (loading()) {
      <div class="state-loading">
        <div class="spinner"></div>
        <span>Loading cart...</span>
      </div>
    } @else if (error()) {
      <div class="state-error">
        <span class="state-error-icon">&#9888;</span>
        <span>{{ error() }}</span>
      </div>
    } @else if (items().length === 0) {
      <div class="empty">
        <span class="empty-icon">&#128722;</span>
        <span class="empty-text">Your cart is empty.</span>
      </div>
    } @else {
      <div class="cart-layout">
        <div class="cart-items">
          @for (item of items(); track item.id) {
            <div class="cart-item">
              <img [src]="item.thumbnail" [alt]="item.title" class="item-thumb" />
              <div class="item-info">
                <div class="item-title">{{ item.title }}</div>
                <div class="item-meta">
                  Qty: {{ item.quantity }} × {{ item.price | currency }}
                  @if (item.discountPercentage > 0) {
                    <span class="item-discount">(-{{ item.discountPercentage }}%)</span>
                  }
                </div>
              </div>
              <div class="item-actions">
                <div class="item-price">{{ item.discountedTotal | currency }}</div>
                <button class="btn-remove" (click)="removeItem(item.id)">Remove</button>
              </div>
            </div>
          }
        </div>

        <div class="summary-card">
          <h3>Order Summary</h3>
          <div class="summary-row">
            <span>Items ({{ totalItems() }})</span>
            <span>{{ totalPrice() | currency }}</span>
          </div>
          <div class="summary-row savings">
            <span>Discount</span>
            <span>-{{ (totalPrice() - totalDiscountedPrice()) | currency }}</span>
          </div>
          <div class="summary-row total">
            <span>Total</span>
            <span>{{ totalDiscountedPrice() | currency }}</span>
          </div>
          @if (!confirmingClear) {
            <button class="btn-clear" (click)="confirmingClear = true">Clear Cart</button>
          } @else {
            <div class="confirm-clear">
              <span>Remove all items?</span>
              <div class="confirm-actions">
                <button class="btn-confirm-yes" (click)="clearCart(); confirmingClear = false">Yes, clear</button>
                <button class="btn-confirm-no" (click)="confirmingClear = false">Cancel</button>
              </div>
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class RemoteEntry {
  private readonly store = inject(CartStore);
  private readonly dispatch = injectDispatch(cartEvents);

  readonly items = computed(() => this.store.entities() as CartItem[]);
  readonly totalItems = computed(() => this.store.totalItems() as number);
  readonly totalPrice = computed(() => this.store.totalPrice() as number);
  readonly totalDiscountedPrice = computed(() => this.store.totalDiscountedPrice() as number);
  readonly loading = computed(() => (this.store as any).loading() as boolean);
  readonly error = computed(() => (this.store as any).error() as string | null);

  confirmingClear = false;

  removeItem(id: number) {
    this.dispatch.removeFromCart({ id });
  }

  clearCart() {
    this.dispatch.clearCart();
  }
}
