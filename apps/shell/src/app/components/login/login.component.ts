import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthStore } from '@org/state-core';

@Component({
  selector: 'shell-login',
  standalone: true,
  imports: [FormsModule],
  styles: [`
    :host {
      display: flex; justify-content: center; align-items: center; min-height: 80vh;
      background-image: radial-gradient(circle at 1px 1px, var(--color-gray-200) 1px, transparent 0);
      background-size: 24px 24px;
    }
    .login-card {
      background: var(--color-surface); border-radius: var(--radius-xl);
      padding: 2rem; box-shadow: var(--shadow-lg); width: 360px;
      animation: fade-slide-up 400ms ease;
    }
    @keyframes fade-slide-up {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }
    h2 { margin: 0 0 1.5rem; text-align: center; color: var(--color-gray-900); }
    .form-group { margin-bottom: 1rem; }
    label { display: block; margin-bottom: 0.25rem; font-weight: 600; color: var(--color-gray-700); font-size: var(--font-size-sm); }
    input {
      width: 100%; padding: 0.625rem; border: 1px solid var(--color-gray-300);
      border-radius: var(--radius-md); font-size: var(--font-size-base);
      box-sizing: border-box; font-family: inherit;
      transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
    }
    input:focus { outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15); }
    button {
      width: 100%; padding: 0.75rem; background: var(--color-primary); color: #fff;
      border: none; border-radius: var(--radius-md); font-size: var(--font-size-base);
      cursor: pointer; font-weight: 600; font-family: inherit;
      transition: background var(--transition-fast);
    }
    button:hover { background: var(--color-primary-hover); }
    button:disabled { background: var(--color-gray-400); cursor: not-allowed; }
    .error { color: var(--color-error); font-size: var(--font-size-sm); margin-top: 0.5rem; text-align: center; }
    .hint { color: var(--color-gray-400); font-size: var(--font-size-xs); text-align: center; margin-top: 1rem; }
  `],
  template: `
    <div class="login-card">
      <h2>Sign In</h2>
      <form (ngSubmit)="onLogin()">
        <div class="form-group">
          <label for="username">Username</label>
          <input id="username" [(ngModel)]="username" name="username" placeholder="Enter username" />
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input id="password" [(ngModel)]="password" name="password" type="password" placeholder="Enter password" />
        </div>
        <button type="submit" [disabled]="loading()">
          {{ loading() ? 'Signing in...' : 'Sign In' }}
        </button>
        @if (error()) {
          <p class="error">{{ error() }}</p>
        }
      </form>
      <p class="hint">Try: emilys / emilyspass</p>
    </div>
  `,
})
export class LoginComponent {
  readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  readonly loading = computed(() => this.authStore.loading());
  readonly error = computed(() => this.authStore.error());

  username = 'emilys';
  password = 'emilyspass';

  constructor() {
    if (this.authStore.isAuthenticated()) {
      this.router.navigate(['/']);
    }
  }

  onLogin() {
    if (!this.username || !this.password) return;
    this.authStore.login({ username: this.username, password: this.password });

    // Watch for successful login and redirect
    const check = setInterval(() => {
      if (this.authStore.isAuthenticated()) {
        clearInterval(check);
        this.router.navigate(['/']);
      }
    }, 100);
    // Cleanup after 10s
    setTimeout(() => clearInterval(check), 10000);
  }
}
