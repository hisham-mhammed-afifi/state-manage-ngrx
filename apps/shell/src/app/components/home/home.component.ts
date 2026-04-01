import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthStore, UserStore } from '@org/state-core';

@Component({
  selector: 'shell-home',
  standalone: true,
  imports: [RouterModule],
  styles: [`
    :host { display: block; max-width: 800px; margin: 2rem auto; }
    .welcome { margin-bottom: 2rem; }
    .welcome h1 { font-size: 1.75rem; color: #1e1b4b; margin: 0 0 .5rem; }
    .welcome p { color: #6b7280; }
    .nav-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; }
    .nav-card { display: block; padding: 1.5rem; border: 1px solid #e5e7eb; border-radius: 10px; text-decoration: none; color: inherit; transition: box-shadow .2s, border-color .2s; }
    .nav-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,.08); border-color: #4f46e5; }
    .nav-card h3 { margin: 0 0 .5rem; color: #1e1b4b; }
    .nav-card p { margin: 0; font-size: .875rem; color: #6b7280; }
    .icon { font-size: 2rem; margin-bottom: .75rem; }
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
    </div>
  `,
})
export class HomeComponent {
  readonly authStore = inject(AuthStore);
  readonly userStore = inject(UserStore);
}
