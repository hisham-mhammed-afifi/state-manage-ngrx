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
    header { display: flex; align-items: center; justify-content: space-between; padding: .75rem 1.5rem; background: #1e1b4b; color: #fff; }
    nav { display: flex; gap: 1rem; align-items: center; }
    nav a { color: #c7d2fe; text-decoration: none; padding: .5rem .75rem; border-radius: 6px; font-weight: 500; }
    nav a:hover, nav a.active { color: #fff; background: rgba(255,255,255,.1); }
    .user-section { display: flex; align-items: center; gap: .75rem; }
    .avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; }
    .user-name { font-weight: 500; font-size: .875rem; }
    .btn-logout { background: rgba(255,255,255,.15); border: none; color: #fff; padding: .375rem .75rem; border-radius: 6px; cursor: pointer; font-size: .8rem; }
    .btn-logout:hover { background: rgba(255,255,255,.25); }
    .btn-login { color: #c7d2fe; text-decoration: none; }
    .cart-link { position: relative; display: inline-flex; align-items: center; color: #c7d2fe; text-decoration: none; padding: .5rem .75rem; border-radius: 6px; font-weight: 500; }
    .cart-link:hover { color: #fff; background: rgba(255,255,255,.1); }
    .cart-badge { position: absolute; top: 0; right: 0; background: #ef4444; color: #fff; font-size: .65rem; font-weight: 700; min-width: 18px; height: 18px; border-radius: 9px; display: flex; align-items: center; justify-content: center; padding: 0 4px; transform: translate(25%, -25%); }
  `],
  template: `
    <header>
      <nav>
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Home</a>
        <a routerLink="/productsMf" routerLinkActive="active">Products</a>
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
