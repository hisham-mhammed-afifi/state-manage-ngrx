# State Management Library Plan

**Stack:** Angular 21 · NgRx Signal Store · Nx Monorepo · Webpack Module Federation (8+ remotes)
**Date:** 2026-03-31
**Status:** Draft

---

## 1. Goals

- Centralize shared state (auth, user session, app flags) in the shell via `state/core`
- Give each remote its own isolated feature state
- Share state at runtime via webpack `shared: {}` singleton pattern (no compile-time coupling)
- Keep 0 classic NgRx boilerplate (no actions/reducers/effects for standard flows)
- Enforce strict lib boundaries via Nx tags
- Standardize on `ngrx-toolkit` custom features (`withDevtools`, `withCallState`) from day one
- Use `withEntities` for all collection-based feature stores
- Keep the architecture lean: add infrastructure only when a concrete need arises

---

## 2. Dependencies

```bash
pnpm add @ngrx/signals @angular-architects/ngrx-toolkit
```

Two packages. That's it.

`@ngrx/store` and `@ngrx/router-store` are intentionally excluded. The plan uses Signal Store exclusively. If `@ngrx/router-store` integration is needed later, it can be added without changing the architecture.

---

## 3. Library Structure

```
libs/
  state/
    core/           # Shell-owned shared state (auth, user, app flags)
  feature/
    <feature-name>/
      state/        # Feature-scoped Signal Store (one per domain, added as needed)
```

### Why this split

- `state/core` is the only lib registered as a runtime singleton in webpack `shared: {}`. Remotes inject stores from `state/core` via DI. It holds auth, user profile, permissions, and app-level flags.
- Feature state libs are buildable but not shared at runtime. Each remote bundles its own. They can import from `state/core` but never from each other.
- There is no events lib on day one. Most remotes are independent and don't need cross-remote communication. If a cross-remote workflow emerges later, a `state/events` lib with `@ngrx/signals/events` can be added without changing existing stores (see Section 10).
- There is no router state lib. The shell can use a plain service or utility for any route-derived signals it needs. Remotes use `ActivatedRoute` directly.

---

## 4. Webpack Shared Configuration

Missing packages here causes duplicate DI injectors and broken singletons at runtime.

### 4.1 Shared Config Helper

Create a single source of truth so shell and remotes never drift:

```ts
// tools/mf-shared.ts

export const SHARED_SINGLETONS = [
  '@angular/core',
  '@angular/common',
  '@angular/common/http',
  '@angular/router',
  '@angular/forms',
  '@angular/platform-browser',
  '@ngrx/signals',
  '@angular-architects/ngrx-toolkit',
  '@org/state-core',
  'rxjs',
] as const;

export function createSharedConfig(libName: string, defaultConfig: Record<string, unknown>): Record<string, unknown> {
  if ((SHARED_SINGLETONS as readonly string[]).includes(libName)) {
    return { singleton: true, strictVersion: true, requiredVersion: 'auto' };
  }
  // Catch secondary entry points (e.g. @angular/core/rxjs-interop)
  if (SHARED_SINGLETONS.some((s) => libName.startsWith(s + '/'))) {
    return { singleton: true, strictVersion: true, requiredVersion: 'auto' };
  }
  return defaultConfig;
}
```

### 4.2 Shell Config

```ts
// apps/shell/module-federation.config.ts
import { createSharedConfig } from '../../tools/mf-shared';

export const config = {
  name: 'shell',
  shared: createSharedConfig,
};
```

### 4.3 Remote Config (same in every remote)

```ts
// apps/remote-<n>/module-federation.config.ts
import { createSharedConfig } from '../../tools/mf-shared';

export const config = {
  name: 'remote-orders', // change per remote
  shared: createSharedConfig,
};
```

---

## 5. Signal Store Patterns

### 5.1 AuthStore (core)

```ts
// libs/state/core/src/lib/auth/auth.store.ts

import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { withDevtools } from '@angular-architects/ngrx-toolkit';
import { withCallState, setLoading, setLoaded, setError } from '@angular-architects/ngrx-toolkit';
import { computed, inject } from '@angular/core';
import { switchMap, exhaustMap, tap } from 'rxjs';
import { AuthService } from './auth.service';

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
};

const initialState: AuthState = {
  accessToken: null,
  refreshToken: null,
  userId: null,
};

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withDevtools('auth'),
  withState(initialState),
  withCallState(),

  withComputed((state) => ({
    isAuthenticated: computed(() => state.accessToken() !== null),
  })),

  withMethods((store, authService = inject(AuthService)) => ({
    login: rxMethod<{ email: string; password: string }>(
      switchMap((credentials) => {
        patchState(store, setLoading());
        return authService.login(credentials).pipe(
          tap({
            next: (tokens) => {
              patchState(store, {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                userId: tokens.userId,
              });
              patchState(store, setLoaded());
            },
            error: (err) => patchState(store, setError(err)),
          })
        );
      })
    ),

    refreshAccessToken: rxMethod<void>(
      exhaustMap(() =>
        authService.refresh(store.refreshToken()!).pipe(
          tap({
            next: (tokens) => {
              patchState(store, {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
              });
            },
            error: (err) => {
              patchState(store, initialState);
              patchState(store, setError(err));
            },
          })
        )
      )
    ),

    logout(): void {
      patchState(store, initialState);
      patchState(store, setLoaded());
    },
  }))
);
```

### 5.2 UserStore (core, reacts to AuthStore via direct injection)

```ts
// libs/state/core/src/lib/user/user.store.ts

import { signalStore, withState, withMethods, withComputed, withHooks, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { withDevtools } from '@angular-architects/ngrx-toolkit';
import { withCallState, setLoading, setLoaded, setError } from '@angular-architects/ngrx-toolkit';
import { computed, inject, effect } from '@angular/core';
import { switchMap, tap } from 'rxjs';
import { UserService } from './user.service';
import { UserProfile, Permission } from './user.model';
import { AuthStore } from '../auth/auth.store';

type UserState = {
  profile: UserProfile | null;
  permissions: Permission[];
};

const initialState: UserState = {
  profile: null,
  permissions: [],
};

export const UserStore = signalStore(
  { providedIn: 'root' },
  withDevtools('user'),
  withState(initialState),
  withCallState(),

  withComputed((state) => ({
    displayName: computed(() => state.profile()?.displayName ?? ''),
  })),

  withMethods((store, userService = inject(UserService)) => ({
    loadProfile: rxMethod<string>(
      switchMap((userId) => {
        patchState(store, setLoading());
        return userService.getProfile(userId).pipe(
          tap({
            next: (profile) => {
              patchState(store, { profile });
              patchState(store, setLoaded());
            },
            error: (err) => patchState(store, setError(err)),
          })
        );
      })
    ),

    loadPermissions: rxMethod<string>(switchMap((userId) => userService.getPermissions(userId).pipe(tap((permissions) => patchState(store, { permissions }))))),

    clear(): void {
      patchState(store, initialState);
    },
  })),

  // React to auth changes via direct signal observation
  withHooks({
    onInit(store) {
      const authStore = inject(AuthStore);

      effect(() => {
        const userId = authStore.userId();
        if (userId) {
          store.loadProfile(userId);
          store.loadPermissions(userId);
        } else {
          store.clear();
        }
      });
    },
  })
);
```

### 5.3 AppStore (core)

```ts
// libs/state/core/src/lib/app/app.store.ts

import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { withDevtools } from '@angular-architects/ngrx-toolkit';
import { computed } from '@angular/core';

type AppState = {
  initialized: boolean;
  maintenanceMode: boolean;
  version: string;
};

const initialState: AppState = {
  initialized: false,
  maintenanceMode: false,
  version: '0.0.0',
};

export const AppStore = signalStore(
  { providedIn: 'root' },
  withDevtools('app'),
  withState(initialState),

  withComputed((state) => ({
    isReady: computed(() => state.initialized() && !state.maintenanceMode()),
  })),

  withMethods((store) => ({
    markInitialized(): void {
      patchState(store, { initialized: true });
    },
    setMaintenanceMode(enabled: boolean): void {
      patchState(store, { maintenanceMode: enabled });
    },
    setVersion(version: string): void {
      patchState(store, { version });
    },
  }))
);
```

### 5.4 Feature Store (per remote, using withEntities)

```ts
// libs/feature/orders/state/src/lib/orders.store.ts

import { signalStore, withState, withMethods, withComputed, withHooks, patchState } from '@ngrx/signals';
import { withEntities, setAllEntities, addEntity, updateEntity, removeEntity } from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { withDevtools } from '@angular-architects/ngrx-toolkit';
import { withCallState, setLoading, setLoaded, setError } from '@angular-architects/ngrx-toolkit';
import { computed, inject } from '@angular/core';
import { switchMap, tap } from 'rxjs';
import { OrdersService } from './orders.service';
import { Order } from './order.model';

type OrdersUiState = {
  selectedId: string | null;
  filter: { status: string | null };
};

export const OrdersStore = signalStore(
  // NO providedIn: 'root' -- scoped to the remote's route providers
  withDevtools('orders'),
  withCallState(),
  withEntities<Order>(),
  withState<OrdersUiState>({
    selectedId: null,
    filter: { status: null },
  }),

  withComputed((state) => ({
    selectedOrder: computed(() => state.entities().find((o) => o.id === state.selectedId())),
    totalCount: computed(() => state.entities().length),
    filteredOrders: computed(() => {
      const status = state.filter().status;
      if (!status) return state.entities();
      return state.entities().filter((o) => o.status === status);
    }),
  })),

  withMethods((store, ordersService = inject(OrdersService)) => ({
    loadOrders: rxMethod<void>(
      switchMap(() => {
        patchState(store, setLoading());
        return ordersService.getOrders().pipe(
          tap({
            next: (orders) => {
              patchState(store, setAllEntities(orders));
              patchState(store, setLoaded());
            },
            error: (err) => patchState(store, setError(err)),
          })
        );
      })
    ),

    createOrder: rxMethod<Partial<Order>>(
      switchMap((data) =>
        ordersService.create(data).pipe(
          tap({
            next: (order) => patchState(store, addEntity(order)),
            error: (err) => patchState(store, setError(err)),
          })
        )
      )
    ),

    updateOrder: rxMethod<Order>(
      switchMap((order) =>
        ordersService.update(order).pipe(
          tap({
            next: (updated) => patchState(store, updateEntity({ id: updated.id, changes: updated })),
            error: (err) => patchState(store, setError(err)),
          })
        )
      )
    ),

    removeOrder: rxMethod<string>(
      switchMap((id) =>
        ordersService.delete(id).pipe(
          tap({
            next: () => patchState(store, removeEntity(id)),
            error: (err) => patchState(store, setError(err)),
          })
        )
      )
    ),

    selectOrder(id: string): void {
      patchState(store, { selectedId: id });
    },

    setFilter(status: string | null): void {
      patchState(store, { filter: { status } });
    },
  })),

  withHooks({
    onInit(store) {
      store.loadOrders();
    },
  })
);
```

### 5.5 Router State (inspiration, not a separate lib)

If the shell needs route-derived signals, a plain service inside the shell app (not in a shared lib) is enough:

```ts
// Example: apps/shell/src/app/services/router-state.service.ts
// This is inspiration only. Claude Code should determine the best
// approach based on what the shell actually needs from the router.

import { Injectable, computed, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class RouterState {
  private router = inject(Router);
  private navEnd = toSignal(this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)), { initialValue: null });

  currentUrl = computed(() => this.navEnd()?.url ?? '/');
  urlSegments = computed(() => this.currentUrl().split('/').filter(Boolean));
}
```

Remotes should use `ActivatedRoute` directly for their route params.

---

## 6. Providers Setup

### 6.1 Shell `app.config.ts`

```ts
import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './interceptors/auth.interceptor';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(appRoutes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    // AuthStore, UserStore, AppStore are all providedIn: 'root'
    // They self-register via DI. No explicit listing needed.
  ],
};
```

### 6.2 Remote Route-Level Providers

```ts
// apps/remote-orders/src/app/app.routes.ts

import { Route } from '@angular/router';
import { OrdersStore } from '@org/feature-orders-state';

export const appRoutes: Route[] = [
  {
    path: '',
    providers: [OrdersStore],
    loadChildren: () => import('./orders/orders.routes'),
  },
];
```

---

## 7. Auth Interceptor

```ts
// apps/shell/src/app/interceptors/auth.interceptor.ts

import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthStore } from '@org/state-core';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authStore = inject(AuthStore);
  const token = authStore.accessToken();

  const authReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authReq);
};
```

---

## 8. Nx Tags & Boundary Rules

### Tag Schema

| Tag                   | Meaning                         |
| --------------------- | ------------------------------- |
| `type:state-core`     | Shell-level shared state        |
| `type:state-feature`  | Feature-scoped state            |
| `scope:shared`        | Usable by shell and all remotes |
| `scope:<remote-name>` | Owned by a specific remote      |

### Boundary Rules

```json
{
  "depConstraints": [
    {
      "sourceTag": "type:state-feature",
      "onlyDependOnLibsWithTags": ["type:state-core", "type:util", "type:data-access"]
    },
    {
      "sourceTag": "scope:remote-a",
      "notAllowedTags": ["scope:remote-b", "scope:remote-c"]
    }
  ]
}
```

---

## 9. Implementation Phases

### Phase 1: Scaffold + Core State (Week 1)

| Task                           | Action                                                                  |
| ------------------------------ | ----------------------------------------------------------------------- |
| Install packages               | `pnpm add @ngrx/signals @angular-architects/ngrx-toolkit`                  |
| Generate `state/core` lib      | `nx g @nx/angular:library ...` with tags `type:state-core,scope:shared` |
| Create shared MF config helper | `tools/mf-shared.ts`                                                    |
| Implement AuthStore            | Login, logout, token refresh                                            |
| Implement UserStore            | Profile loading, reacts to AuthStore via effect()                       |
| Implement AppStore             | Init flags, maintenance mode                                            |
| Add auth interceptor           | In shell only                                                           |
| Update webpack shared configs  | Shell + all existing remotes                                            |
| Add Nx boundary rules          | depConstraints in eslint config                                         |
| Write unit tests               | For each store                                                          |

### Phase 2: Feature States (Per remote, ongoing)

For each remote as needed:

- Generate `libs/feature/<name>/state` with tags `type:state-feature,scope:<remote>`
- Implement store using `withEntities` + `withCallState` + `withDevtools` + `withHooks`
- Register in remote route providers
- Write unit tests

### Phase 3: Hardening (Week 3+)

- Add `withGlitchTracking()` to devtools for stores that need fine-grained tracking
- Add error boundary handling
- Token refresh flow with 401 retry in interceptor
- Performance audit: verify no duplicate Angular instances across remotes

---

## 10. Future: Events Layer (add when needed)

When a concrete cross-remote workflow emerges (e.g., "order created in remote-orders needs to trigger a refresh in remote-dashboard"), add:

1. A `state/events` lib with `eventGroup` definitions from `@ngrx/signals/events`
2. `provideDispatcher()` in the shell's `app.config.ts`
3. `withEffects` in stores that need to react to cross-domain events
4. `injectDispatch` in components that need to fire events
5. Add `@org/state-events` to the webpack shared singleton list

This can be done incrementally without changing any existing store code. The direct injection pattern used by UserStore today (watching AuthStore signals) continues to work alongside events.

---

## 11. Testing Strategy

```ts
// auth.store.spec.ts

import { TestBed } from '@angular/core/testing';
import { AuthStore } from './auth.store';
import { AuthService } from './auth.service';
import { of } from 'rxjs';

describe('AuthStore', () => {
  let store: InstanceType<typeof AuthStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuthStore,
        {
          provide: AuthService,
          useValue: {
            login: vi.fn().mockReturnValue(of({ accessToken: 'tok', refreshToken: 'ref', userId: '1' })),
          },
        },
      ],
    });
    store = TestBed.inject(AuthStore);
  });

  it('should start with null tokens and init call state', () => {
    expect(store.accessToken()).toBeNull();
    expect(store.isAuthenticated()).toBe(false);
  });

  it('should authenticate on successful login', () => {
    store.login({ email: 'a@b.com', password: 'pass' });
    expect(store.isAuthenticated()).toBe(true);
    expect(store.accessToken()).toBe('tok');
    expect(store.loaded()).toBe(true);
  });

  it('should clear state on logout', () => {
    store.login({ email: 'a@b.com', password: 'pass' });
    store.logout();
    expect(store.isAuthenticated()).toBe(false);
    expect(store.accessToken()).toBeNull();
  });
});
```

---

## 12. Folder Conventions

```
libs/
  state/
    core/
      src/
        lib/
          auth/
            auth.store.ts
            auth.service.ts
            auth.model.ts
          user/
            user.store.ts
            user.service.ts
            user.model.ts
          app/
            app.store.ts
        index.ts              # ONLY public API exports
      project.json
  feature/
    orders/
      state/
        src/
          lib/
            orders.store.ts
            orders.service.ts
            order.model.ts
          index.ts
        project.json
tools/
  mf-shared.ts               # Shared singleton list for webpack configs
```

---

## 13. Key Rules Summary

1. `providedIn: 'root'` only on stores in `state/core`
2. Feature stores are registered at route level via `providers: [FeatureStore]`
3. Remotes never import from each other, only from `state/core` and their own feature libs
4. `index.ts` is the only export surface; internal paths are never imported directly
5. Every app's webpack shared config must use the `createSharedConfig` helper from `tools/mf-shared.ts`
6. All stores include `withDevtools('name')` from day one
7. All collection stores use `withEntities` from `@ngrx/signals/entities`
8. All stores use `withCallState()` for loading/error tracking
9. Auth interceptor lives in the shell only; remotes benefit via shared `HttpClient`
10. Core stores communicate via direct injection and signal observation (no event bus on day one)
11. The events layer (`@ngrx/signals/events`) is added only when a cross-remote workflow requires it
12. Router state is a plain service in the shell, not a shared lib
