import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthStore } from '@org/state-core';

@Component({
  selector: 'shell-login',
  standalone: true,
  imports: [FormsModule],
  styles: [`
    :host { display: flex; justify-content: center; align-items: center; min-height: 80vh; }
    .login-card { background: #fff; border-radius: 12px; padding: 2rem; box-shadow: 0 4px 24px rgba(0,0,0,.1); width: 360px; }
    h2 { margin: 0 0 1.5rem; text-align: center; color: #333; }
    .form-group { margin-bottom: 1rem; }
    label { display: block; margin-bottom: .25rem; font-weight: 600; color: #555; font-size: .875rem; }
    input { width: 100%; padding: .625rem; border: 1px solid #ddd; border-radius: 6px; font-size: 1rem; box-sizing: border-box; }
    input:focus { outline: none; border-color: #4f46e5; box-shadow: 0 0 0 2px rgba(79,70,229,.15); }
    button { width: 100%; padding: .75rem; background: #4f46e5; color: #fff; border: none; border-radius: 6px; font-size: 1rem; cursor: pointer; font-weight: 600; }
    button:hover { background: #4338ca; }
    button:disabled { background: #9ca3af; cursor: not-allowed; }
    .error { color: #dc2626; font-size: .875rem; margin-top: .5rem; text-align: center; }
    .hint { color: #9ca3af; font-size: .75rem; text-align: center; margin-top: 1rem; }
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
