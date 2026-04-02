import { Component, inject, computed } from '@angular/core';
import { ProductsStore, Product } from '@org/feature-products-state';
import { cartEvents, CartProduct } from '@org/state-core';
import { injectDispatch } from '@ngrx/signals/events';
import { CurrencyPipe } from '@angular/common';

@Component({
  selector: 'products-mf-entry',
  standalone: true,
  imports: [CurrencyPipe],
  styles: [`
    :host { display: block; }
    .toolbar { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; margin-bottom: 1rem; }
    .search-input {
      padding: 0.5rem 0.75rem; border: 1px solid var(--color-gray-300, #d1d5db);
      border-radius: var(--radius-md, 6px); font-size: var(--font-size-sm, 0.875rem);
      min-width: 200px; font-family: inherit;
      transition: border-color var(--transition-fast, 150ms ease), box-shadow var(--transition-fast, 150ms ease);
    }
    .search-input:focus { outline: none; border-color: var(--color-primary, #4f46e5); box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15); }
    .categories { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .cat-btn {
      padding: 0.375rem 0.75rem; border: 1px solid var(--color-gray-300, #d1d5db);
      border-radius: var(--radius-full, 9999px); background: var(--color-surface, #fff);
      cursor: pointer; font-size: var(--font-size-xs, 0.75rem); font-family: inherit;
      transition: all var(--transition-fast, 150ms ease);
    }
    .cat-btn:hover { background: var(--color-primary-light, #e0e7ff); border-color: var(--color-primary, #4f46e5); color: var(--color-primary-text, #4338ca); }
    .cat-btn.active { background: var(--color-primary, #4f46e5); color: #fff; border-color: var(--color-primary, #4f46e5); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; }
    .card {
      border: 1px solid var(--color-border, #e5e7eb); border-radius: var(--radius-lg, 8px);
      overflow: hidden; cursor: pointer; background: var(--color-surface, #fff);
      transition: box-shadow var(--transition-base, 200ms ease), transform var(--transition-base, 200ms ease);
    }
    .card:hover { box-shadow: var(--shadow-md, 0 4px 12px rgba(0,0,0,.1)); transform: translateY(-2px); }
    .card:focus-visible { outline: 2px solid var(--color-primary, #4f46e5); outline-offset: 2px; }
    .card img { width: 100%; height: 160px; object-fit: cover; }
    .card-body { padding: 0.75rem; }
    .card-title { font-weight: 600; font-size: var(--font-size-sm, 0.875rem); margin: 0 0 0.25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .card-price { color: var(--color-primary, #4f46e5); font-weight: 700; font-size: var(--font-size-base, 1rem); }
    .card-meta { font-size: var(--font-size-xs, 0.75rem); color: var(--color-gray-500, #6b7280); margin-top: 0.25rem; }
    .rating { color: var(--color-warning, #f59e0b); }
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
    .detail-backdrop {
      position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4);
      z-index: 99; animation: fade-in 200ms ease;
    }
    @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
    .detail-overlay {
      position: fixed; top: 0; right: 0; bottom: 0; width: 420px;
      background: var(--color-surface, #fff);
      box-shadow: var(--shadow-xl, -4px 0 24px rgba(0,0,0,.15));
      z-index: 100; overflow-y: auto; padding: 1.5rem;
      animation: slide-in-right 300ms ease;
    }
    @keyframes slide-in-right { from { transform: translateX(100%); } to { transform: translateX(0); } }
    @media (max-width: 480px) { .detail-overlay { width: 100%; } }
    .detail-overlay img { width: 100%; border-radius: var(--radius-lg, 8px); margin-bottom: 0.75rem; }
    .detail-overlay h2 { margin: 0 0 0.5rem; }
    .detail-overlay .close-btn {
      position: absolute; top: 1rem; right: 1rem;
      background: var(--color-gray-100, #f3f4f6); border: none;
      width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 1.2rem;
      transition: background var(--transition-fast, 150ms ease);
    }
    .detail-overlay .close-btn:hover { background: var(--color-gray-200, #e5e7eb); }
    .badge { display: inline-block; background: var(--color-primary-light, #e0e7ff); color: var(--color-primary-text, #4338ca); padding: 0.125rem 0.5rem; border-radius: var(--radius-xl, 12px); font-size: var(--font-size-xs, 0.75rem); }
    .discount { color: var(--color-error, #dc2626); font-size: var(--font-size-sm, 0.875rem); }
    .stock { font-size: var(--font-size-sm, 0.875rem); }
    .stock.low { color: var(--color-error, #dc2626); }
    .stock.ok { color: var(--color-success, #16a34a); }
    .btn-cart {
      display: inline-flex; align-items: center; gap: 0.375rem; margin-top: 0.5rem;
      padding: 0.375rem 0.75rem; background: var(--color-primary, #4f46e5); color: #fff;
      border: none; border-radius: var(--radius-md, 6px); cursor: pointer;
      font-size: 0.8rem; font-weight: 600; font-family: inherit;
      transition: background var(--transition-fast, 150ms ease);
    }
    .btn-cart:hover { background: var(--color-primary-hover, #4338ca); }
    .btn-cart-detail { width: 100%; margin-top: 1rem; padding: 0.625rem; font-size: 0.9rem; }
  `],
  template: `
    <div class="toolbar">
      <input class="search-input" placeholder="Search products..." (input)="onSearch($event)" />
      <button class="cat-btn" [class.active]="!filterCategory()" (click)="clearFilter()">All</button>
      <div class="categories">
        @for (cat of categories(); track cat) {
          <button class="cat-btn" [class.active]="filterCategory() === cat" (click)="loadByCategory(cat)">
            {{ cat }}
          </button>
        }
      </div>
    </div>

    @if (loading()) {
      <div class="state-loading">
        <div class="spinner"></div>
        <span>Loading products...</span>
      </div>
    } @else if (error()) {
      <div class="state-error">
        <span class="state-error-icon">&#9888;</span>
        <span>{{ error() }}</span>
      </div>
    } @else {
      <div class="grid">
        @for (product of products(); track product.id) {
          <div class="card" (click)="selectProduct(product.id)" (keydown.enter)="selectProduct(product.id)" tabindex="0" role="button">
            <img [src]="product.thumbnail" [alt]="product.title" />
            <div class="card-body">
              <p class="card-title">{{ product.title }}</p>
              <span class="card-price">{{ product.price | currency }}</span>
              <div class="card-meta">
                <span class="rating">{{ getStars(product.rating) }}</span>
                {{ product.rating.toFixed(1) }}
                · <span class="badge">{{ product.category }}</span>
              </div>
              <button class="btn-cart" (click)="addToCart(product, $event)">&#128722; Add to Cart</button>
            </div>
          </div>
        }
      </div>
    }

    @if (selectedProduct(); as product) {
      <div class="detail-backdrop" (click)="selectProduct(null)"></div>
      <div class="detail-overlay">
        <button class="close-btn" (click)="selectProduct(null)">&#10005;</button>
        <img [src]="product.thumbnail" [alt]="product.title" />
        <h2>{{ product.title }}</h2>
        <span class="badge">{{ product.category }}</span>
        @if (product.brand) { · <strong>{{ product.brand }}</strong> }
        <p>{{ product.description }}</p>
        <p class="card-price">{{ product.price | currency }}
          @if (product.discountPercentage > 0) {
            <span class="discount"> -{{ product.discountPercentage }}%</span>
          }
        </p>
        <p class="rating">{{ getStars(product.rating) }} {{ product.rating.toFixed(1) }}</p>
        <p class="stock" [class.low]="product.stock < 10" [class.ok]="product.stock >= 10">
          Stock: {{ product.stock }}
        </p>
        <button class="btn-cart btn-cart-detail" (click)="addToCart(product, $event)">&#128722; Add to Cart</button>
      </div>
    }
  `,
})
export class RemoteEntry {
  readonly store = inject(ProductsStore);
  private readonly dispatch = injectDispatch(cartEvents);

  readonly products = computed(() => this.store.entities() as Product[]);
  readonly selectedProduct = computed(() => this.store.selectedProduct() as Product | null);
  readonly categories = computed(() => this.store.categories() as string[]);
  readonly filterCategory = computed(() => this.store.filterCategory() as string | null);
  readonly loading = computed(() => (this.store as any).loading() as boolean);
  readonly error = computed(() => (this.store as any).error() as string | null);

  private searchTimeout: ReturnType<typeof setTimeout> | null = null;

  selectProduct(id: number | null) {
    this.store.selectProduct(id);
  }

  loadByCategory(category: string) {
    this.store.loadByCategory(category);
  }

  addToCart(product: Product, event: Event) {
    event.stopPropagation();
    this.dispatch.addToCart({
      id: product.id,
      title: product.title,
      price: product.price,
      thumbnail: product.thumbnail,
      discountPercentage: product.discountPercentage,
    });
  }

  getStars(rating: number): string {
    return '\u2605'.repeat(Math.round(rating));
  }

  onSearch(event: Event) {
    const query = (event.target as HTMLInputElement).value;
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      if (query.trim()) {
        this.store.searchProducts(query.trim());
      } else {
        this.store.loadProducts();
      }
    }, 400);
  }

  clearFilter() {
    this.store.loadProducts();
  }
}
