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
    .toolbar { display: flex; gap: .75rem; align-items: center; flex-wrap: wrap; margin-bottom: 1rem; }
    .search-input { padding: .5rem .75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: .875rem; min-width: 200px; }
    .categories { display: flex; gap: .5rem; flex-wrap: wrap; }
    .cat-btn { padding: .375rem .75rem; border: 1px solid #d1d5db; border-radius: 20px; background: #fff; cursor: pointer; font-size: .75rem; }
    .cat-btn:hover, .cat-btn.active { background: #4f46e5; color: #fff; border-color: #4f46e5; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; }
    .card { border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; cursor: pointer; transition: box-shadow .2s; background: #fff; }
    .card:hover { box-shadow: 0 4px 12px rgba(0,0,0,.1); }
    .card img { width: 100%; height: 160px; object-fit: cover; }
    .card-body { padding: .75rem; }
    .card-title { font-weight: 600; font-size: .875rem; margin: 0 0 .25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .card-price { color: #4f46e5; font-weight: 700; font-size: 1rem; }
    .card-meta { font-size: .75rem; color: #6b7280; margin-top: .25rem; }
    .rating { color: #f59e0b; }
    .loading { text-align: center; padding: 2rem; color: #6b7280; }
    .error { text-align: center; padding: 2rem; color: #dc2626; }
    .detail-overlay { position: fixed; top: 0; right: 0; bottom: 0; width: 420px; background: #fff; box-shadow: -4px 0 24px rgba(0,0,0,.15); z-index: 100; overflow-y: auto; padding: 1.5rem; }
    .detail-overlay img { width: 100%; border-radius: 8px; margin-bottom: .75rem; }
    .detail-overlay h2 { margin: 0 0 .5rem; }
    .detail-overlay .close-btn { position: absolute; top: 1rem; right: 1rem; background: #f3f4f6; border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 1.2rem; }
    .badge { display: inline-block; background: #e0e7ff; color: #4338ca; padding: .125rem .5rem; border-radius: 12px; font-size: .75rem; }
    .discount { color: #dc2626; font-size: .875rem; }
    .stock { font-size: .875rem; }
    .stock.low { color: #dc2626; }
    .stock.ok { color: #16a34a; }
    .btn-cart { display: inline-flex; align-items: center; gap: .375rem; margin-top: .5rem; padding: .375rem .75rem; background: #4f46e5; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: .8rem; font-weight: 600; }
    .btn-cart:hover { background: #4338ca; }
    .btn-cart-detail { width: 100%; margin-top: 1rem; padding: .625rem; font-size: .9rem; }
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
      <div class="loading">Loading products...</div>
    } @else if (error()) {
      <div class="error">{{ error() }}</div>
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
