import { Component, inject, computed } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { AuthStore, UserStore } from '@org/state-core';
import { CartStore } from '@org/feature-cart-state';

@Component({
  selector: 'shell-header',
  standalone: true,
  imports: [RouterModule],
  styles: [`
    :host { display: block; }
    header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.75rem 1.5rem; background: var(--color-navy); color: #fff;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      position: sticky; top: 0; z-index: 50;
    }
    nav { display: flex; gap: 0.25rem; align-items: center; }
    nav a {
      color: #c7d2fe; text-decoration: none; padding: 0.5rem 0.75rem;
      border-radius: var(--radius-md); font-weight: 500; font-size: var(--font-size-sm);
      transition: color var(--transition-fast), background var(--transition-fast);
    }
    nav a:hover { color: #fff; background: rgba(255, 255, 255, 0.1); }
    nav a.active { color: #fff; background: rgba(255, 255, 255, 0.15); }
    .user-section { display: flex; align-items: center; gap: 0.75rem; }
    .avatar {
      width: 32px; height: 32px; border-radius: var(--radius-full);
      object-fit: cover; border: 2px solid rgba(255, 255, 255, 0.2);
    }
    .user-name { font-weight: 500; font-size: var(--font-size-sm); }
    .btn-logout {
      background: rgba(255, 255, 255, 0.15); border: none; color: #fff;
      padding: 0.375rem 0.75rem; border-radius: var(--radius-md);
      cursor: pointer; font-size: 0.8rem; font-family: inherit;
      transition: background var(--transition-fast);
    }
    .btn-logout:hover { background: rgba(255, 255, 255, 0.25); }
    .btn-login {
      color: #c7d2fe; text-decoration: none; padding: 0.5rem 0.75rem;
      border-radius: var(--radius-md);
      transition: color var(--transition-fast), background var(--transition-fast);
    }
    .btn-login:hover { color: #fff; background: rgba(255, 255, 255, 0.1); }
    .cart-link {
      position: relative; display: inline-flex; align-items: center;
      color: #c7d2fe; text-decoration: none; padding: 0.5rem 0.75rem;
      border-radius: var(--radius-md); font-weight: 500;
      transition: color var(--transition-fast), background var(--transition-fast);
    }
    .cart-link:hover { color: #fff; background: rgba(255, 255, 255, 0.1); }
    .cart-badge {
      position: absolute; top: 0; right: 0;
      background: #ef4444; color: #fff; font-size: 0.65rem; font-weight: 700;
      min-width: 18px; height: 18px; border-radius: var(--radius-full);
      display: flex; align-items: center; justify-content: center;
      padding: 0 4px; transform: translate(25%, -25%);
      animation: badge-pop 200ms ease;
    }
    @keyframes badge-pop {
      0% { transform: translate(25%, -25%) scale(0); }
      70% { transform: translate(25%, -25%) scale(1.2); }
      100% { transform: translate(25%, -25%) scale(1); }
    }
    @media (max-width: 640px) {
      header { flex-wrap: wrap; gap: 0.5rem; padding: 0.75rem 1rem; }
      nav { order: 2; width: 100%; overflow-x: auto; gap: 0.25rem; }
      .user-section { order: 1; }
    }
  `],
  template: `
    <header>
      <nav>
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Home</a>
        <a routerLink="/productsMf" routerLinkActive="active">Products</a>
        <a routerLink="/guide" routerLinkActive="active">Guide</a>
        @if (isAuthenticated()) {
          <a routerLink="/orders" routerLinkActive="active">Orders</a>
        }
        <a routerLink="/cart" routerLinkActive="active" class="cart-link">
          &#128722; Cart
          @if (cartItemCount() > 0) {
            <span class="cart-badge">{{ cartItemCount() }}</span>
          }
        </a>
      </nav>
      <div class="user-section">
        @if (isAuthenticated()) {
          @if (userProfile(); as profile) {
            <img [src]="profile.image" [alt]="displayName()" class="avatar" />
            <span class="user-name">{{ displayName() }}</span>
          }
          <button class="btn-logout" (click)="onLogout()">Logout</button>
        } @else {
          <a routerLink="/login" class="btn-login">Sign In</a>
        }
      </div>
    </header>
  `,
})
export class HeaderComponent {
  private readonly authStore = inject(AuthStore);
  private readonly userStore = inject(UserStore);
  private readonly cartStore = inject(CartStore);
  private readonly router = inject(Router);

  readonly isAuthenticated = computed(() => this.authStore.isAuthenticated() as boolean);
  readonly userProfile = computed(() => (this.userStore as any).profile() as { image: string } | null);
  readonly displayName = computed(() => this.userStore.displayName() as string);
  readonly cartItemCount = computed(() => this.cartStore.totalItems() as number);

  onLogout() {
    this.authStore.logout();
    this.router.navigate(['/login']);
  }
}
