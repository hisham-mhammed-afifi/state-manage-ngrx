import { inject, computed } from '@angular/core';
import { signalStore, withState, withComputed, withMethods } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { withDevtools, withCallState, setLoading, setLoaded, setError, updateState } from '@angular-architects/ngrx-toolkit';
import { pipe, switchMap, exhaustMap, tap, EMPTY } from 'rxjs';
import { AuthService } from './auth.service';
import { AuthState, LoginCredentials } from './auth.model';

const initialAuthState: AuthState = {
  accessToken: null,
  refreshToken: null,
  userId: null,
};

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withDevtools('auth'),
  withState(initialAuthState),
  withCallState(),
  withComputed((store) => ({
    isAuthenticated: computed(() => store.accessToken() !== null),
  })),
  withMethods((store) => {
    const authService = inject(AuthService);

    return {
      login: rxMethod<LoginCredentials>(
        pipe(
          tap(() => updateState(store, 'login', setLoading())),
          switchMap((credentials) =>
            authService.login(credentials).pipe(
              tap({
                next: (response) =>
                  updateState(store, 'login success', {
                    accessToken: response.accessToken,
                    refreshToken: response.refreshToken,
                    userId: response.id,
                    ...setLoaded(),
                  }),
                error: (error) =>
                  updateState(
                    store,
                    'login error',
                    setError(error?.error?.message ?? error?.message ?? 'Login failed')
                  ),
              })
            )
          )
        )
      ),

      refreshAccessToken: rxMethod<void>(
        pipe(
          tap(() => updateState(store, 'refresh token', setLoading())),
          exhaustMap(() => {
            const token = store.refreshToken();
            if (!token) return EMPTY;

            return authService.refreshToken(token).pipe(
              tap({
                next: (response) =>
                  updateState(store, 'refresh token success', {
                    accessToken: response.accessToken,
                    refreshToken: response.refreshToken,
                    ...setLoaded(),
                  }),
                error: () =>
                  updateState(store, 'refresh token error', {
                    ...initialAuthState,
                    ...setError('Session expired'),
                  }),
              })
            );
          })
        )
      ),

      logout(): void {
        updateState(store, 'logout', initialAuthState);
      },
    };
  })
);
