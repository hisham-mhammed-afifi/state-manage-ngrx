import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthStore, UserStore } from '@org/state-core';

@Component({
  selector: 'shell-home',
  standalone: true,
  imports: [RouterModule],
  styles: [`
    :host { display: block; max-width: 800px; margin: var(--space-8) auto; }
    .welcome { margin-bottom: var(--space-8); }
    .welcome h1 { font-size: var(--font-size-3xl); color: var(--color-navy); margin: 0 0 0.5rem; font-weight: 700; }
    .welcome p { color: var(--color-gray-500); font-size: var(--font-size-lg); }
    .nav-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--space-4); }
    .nav-card {
      display: block; padding: 1.5rem; border: 1px solid var(--color-border);
      border-radius: var(--radius-xl); text-decoration: none; color: inherit;
      background: var(--color-surface);
      transition: box-shadow var(--transition-base), border-color var(--transition-base), transform var(--transition-base);
    }
    .nav-card:hover { box-shadow: var(--shadow-md); border-color: var(--color-primary); transform: translateY(-2px); }
    .nav-card h3 { margin: 0 0 0.5rem; color: var(--color-navy); }
    .nav-card p { margin: 0; font-size: var(--font-size-sm); color: var(--color-gray-500); }
    .icon {
      font-size: 1.5rem; margin-bottom: 0.75rem;
      width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;
      background: var(--color-primary-light); border-radius: var(--radius-lg);
    }
  `],
  template: `
    <div class="welcome">
      @if (authStore.isAuthenticated()) {
        <h1>Welcome back, {{ userStore.displayName() }}</h1>
        <p>Explore the micro-frontend modules below.</p>
      } @else {
        <h1>Welcome to the Store</h1>
        <p>Sign in to access orders and cart, or browse products as a guest.</p>
      }
    </div>

    <div class="nav-grid">
      <a class="nav-card" routerLink="/productsMf">
        <div class="icon">🛍</div>
        <h3>Products</h3>
        <p>Browse the product catalog with search and category filters.</p>
      </a>

      @if (authStore.isAuthenticated()) {
        <a class="nav-card" routerLink="/orders">
          <div class="icon">📦</div>
          <h3>Orders</h3>
          <p>View your order history and details.</p>
        </a>

        <a class="nav-card" routerLink="/cart">
          <div class="icon">🛒</div>
          <h3>Cart</h3>
          <p>Review items in your shopping cart.</p>
        </a>
      } @else {
        <a class="nav-card" routerLink="/login">
          <div class="icon">🔑</div>
          <h3>Sign In</h3>
          <p>Log in to access orders and cart.</p>
        </a>
      }

      <a class="nav-card" routerLink="/guide">
        <div class="icon">&#128214;</div>
        <h3>Guide</h3>
        <p>Learn state management patterns, architecture, and best practices.</p>
      </a>
    </div>
  `,
})
export class HomeComponent {
  readonly authStore = inject(AuthStore);
  readonly userStore = inject(UserStore);
}
