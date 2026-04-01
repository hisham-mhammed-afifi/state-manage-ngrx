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
    h2 { margin: 0 0 1rem; color: #1e1b4b; }
    .loading { text-align: center; padding: 2rem; color: #6b7280; }
    .error { text-align: center; padding: 2rem; color: #dc2626; }
    .empty { text-align: center; padding: 2rem; color: #9ca3af; }
    .cart-layout { display: grid; grid-template-columns: 1fr 300px; gap: 1.5rem; }
    @media (max-width: 768px) { .cart-layout { grid-template-columns: 1fr; } }
    .cart-items { display: flex; flex-direction: column; gap: .5rem; }
    .cart-item { display: flex; align-items: center; gap: 1rem; padding: .75rem; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; }
    .item-thumb { width: 64px; height: 64px; object-fit: cover; border-radius: 6px; }
    .item-info { flex: 1; }
    .item-title { font-weight: 600; font-size: .875rem; }
    .item-meta { font-size: .75rem; color: #6b7280; margin-top: .25rem; }
    .item-price { font-weight: 700; color: #4f46e5; }
    .item-discount { font-size: .75rem; color: #16a34a; }
    .btn-remove { background: none; border: none; color: #dc2626; cursor: pointer; font-size: .8rem; padding: .25rem .5rem; }
    .btn-remove:hover { text-decoration: underline; }
    .summary-card { border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; padding: 1.25rem; height: fit-content; }
    .summary-card h3 { margin: 0 0 1rem; font-size: 1rem; }
    .summary-row { display: flex; justify-content: space-between; padding: .375rem 0; font-size: .875rem; }
    .summary-row.total { border-top: 2px solid #e5e7eb; margin-top: .5rem; padding-top: .75rem; font-weight: 700; font-size: 1rem; }
    .savings { color: #16a34a; }
    .btn-clear { width: 100%; margin-top: 1rem; padding: .625rem; background: #fee2e2; color: #dc2626; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }
    .btn-clear:hover { background: #fecaca; }
  `],
  template: `
    <h2>Shopping Cart</h2>

    @if (loading()) {
      <div class="loading">Loading cart...</div>
    } @else if (error()) {
      <div class="error">{{ error() }}</div>
    } @else if (items().length === 0) {
      <div class="empty">Your cart is empty.</div>
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
              <div style="text-align: right;">
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
          <button class="btn-clear" (click)="clearCart()">Clear Cart</button>
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

  removeItem(id: number) {
    this.dispatch.removeFromCart({ id });
  }

  clearCart() {
    this.dispatch.clearCart();
  }
}
