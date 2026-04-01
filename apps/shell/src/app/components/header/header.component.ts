import { Component, inject } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { AuthStore, UserStore } from '@org/state-core';

@Component({
  selector: 'shell-header',
  standalone: true,
  imports: [RouterModule],
  styles: [`
    :host { display: block; }
    header { display: flex; align-items: center; justify-content: space-between; padding: .75rem 1.5rem; background: #1e1b4b; color: #fff; }
    nav { display: flex; gap: 1rem; }
    nav a { color: #c7d2fe; text-decoration: none; padding: .5rem .75rem; border-radius: 6px; font-weight: 500; }
    nav a:hover, nav a.active { color: #fff; background: rgba(255,255,255,.1); }
    .user-section { display: flex; align-items: center; gap: .75rem; }
    .avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; }
    .user-name { font-weight: 500; font-size: .875rem; }
    .btn-logout { background: rgba(255,255,255,.15); border: none; color: #fff; padding: .375rem .75rem; border-radius: 6px; cursor: pointer; font-size: .8rem; }
    .btn-logout:hover { background: rgba(255,255,255,.25); }
    .btn-login { color: #c7d2fe; text-decoration: none; }
  `],
  template: `
    <header>
      <nav>
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Home</a>
        <a routerLink="/productsMf" routerLinkActive="active">Products</a>
        @if (authStore.isAuthenticated()) {
          <a routerLink="/orders" routerLinkActive="active">Orders</a>
          <a routerLink="/cart" routerLinkActive="active">Cart</a>
        }
      </nav>
      <div class="user-section">
        @if (authStore.isAuthenticated()) {
          @if (userStore.profile(); as profile) {
            <img [src]="profile.image" [alt]="userStore.displayName()" class="avatar" />
            <span class="user-name">{{ userStore.displayName() }}</span>
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
  readonly authStore = inject(AuthStore);
  readonly userStore = inject(UserStore);
  private readonly router = inject(Router);

  onLogout() {
    this.authStore.logout();
    this.router.navigate(['/login']);
  }
}
