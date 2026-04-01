import { Component, inject, computed, Signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { OrdersStore, Order } from '@org/feature-orders-state';

@Component({
  selector: 'orders-orders-entry',
  standalone: true,
  imports: [CurrencyPipe],
  styles: [`
    :host { display: block; }
    h2 { margin: 0 0 1rem; color: #1e1b4b; }
    .loading { text-align: center; padding: 2rem; color: #6b7280; }
    .error { text-align: center; padding: 2rem; color: #dc2626; }
    .empty { text-align: center; padding: 2rem; color: #9ca3af; }
    .orders-list { display: flex; flex-direction: column; gap: .75rem; }
    .order-card { border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; overflow: hidden; cursor: pointer; transition: box-shadow .2s; }
    .order-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,.08); }
    .order-card.selected { border-color: #4f46e5; box-shadow: 0 0 0 2px rgba(79,70,229,.15); }
    .order-header { display: flex; justify-content: space-between; align-items: center; padding: .75rem 1rem; background: #f9fafb; }
    .order-id { font-weight: 600; color: #374151; }
    .order-total { font-weight: 700; color: #4f46e5; }
    .order-meta { font-size: .8rem; color: #6b7280; }
    .order-products { padding: .75rem 1rem; border-top: 1px solid #e5e7eb; }
    .product-row { display: flex; align-items: center; gap: .75rem; padding: .375rem 0; border-bottom: 1px solid #f3f4f6; }
    .product-row:last-child { border-bottom: none; }
    .product-thumb { width: 40px; height: 40px; object-fit: cover; border-radius: 4px; }
    .product-info { flex: 1; }
    .product-title { font-size: .875rem; font-weight: 500; }
    .product-qty { font-size: .75rem; color: #6b7280; }
    .product-price { font-weight: 600; font-size: .875rem; }
    .order-summary { display: flex; justify-content: space-between; padding: .75rem 1rem; background: #f0fdf4; font-size: .875rem; }
    .discount { color: #16a34a; font-weight: 600; }
  `],
  template: `
    <h2>Order History</h2>

    @if (loading()) {
      <div class="loading">Loading orders...</div>
    } @else if (error()) {
      <div class="error">{{ error() }}</div>
    } @else if (orders().length === 0) {
      <div class="empty">No orders found.</div>
    } @else {
      <div class="orders-list">
        @for (order of orders(); track order.id) {
          <div class="order-card" [class.selected]="selectedId() === order.id" (click)="selectOrder(order.id)" (keydown.enter)="selectOrder(order.id)" tabindex="0" role="button">
            <div class="order-header">
              <div>
                <span class="order-id">Order #{{ order.id }}</span>
                <span class="order-meta"> · {{ order.totalProducts }} products · {{ order.totalQuantity }} items</span>
              </div>
              <span class="order-total">{{ order.total | currency }}</span>
            </div>

            @if (selectedId() === order.id) {
              <div class="order-products">
                @for (product of order.products; track product.id) {
                  <div class="product-row">
                    <img [src]="product.thumbnail" [alt]="product.title" class="product-thumb" />
                    <div class="product-info">
                      <div class="product-title">{{ product.title }}</div>
                      <div class="product-qty">Qty: {{ product.quantity }} × {{ product.price | currency }}</div>
                    </div>
                    <span class="product-price">{{ product.total | currency }}</span>
                  </div>
                }
              </div>
              <div class="order-summary">
                <span>Subtotal: {{ order.total | currency }}</span>
                <span class="discount">Discounted: {{ order.discountedTotal | currency }}</span>
              </div>
            }
          </div>
        }
      </div>
    }
  `,
})
export class RemoteEntry {
  private readonly store = inject(OrdersStore);

  readonly orders = computed(() => this.store.entities() as Order[]);
  readonly selectedId = computed(() => this.store.selectedId() as number | null);
  readonly loading = computed(() => (this.store as any).loading() as boolean);
  readonly error = computed(() => (this.store as any).error() as string | null);

  selectOrder(id: number) {
    this.store.selectOrder(id);
  }
}
