# Chapter 6: Store Patterns and Recipes

> This chapter walks through every store in the workspace, annotated with "why" for each design choice. Use these as templates when building new stores.

All code in this chapter is from the actual workspace. Import paths and function signatures match the installed packages.

---

## 6.1 AuthStore: Token Management

The `AuthStore` is the foundation of the state layer. It manages authentication tokens, tracks login status, and provides the `isAuthenticated` and `userId` signals that other stores depend on.

### The Model

```typescript
// libs/state/core/src/lib/auth/auth.model.ts

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  image: string;
  accessToken: string;
  refreshToken: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  userId: number | null;
}
```

### The Service

```typescript
// libs/state/core/src/lib/auth/auth.service.ts

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LoginCredentials, LoginResponse, TokenResponse } from './auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'https://dummyjson.com/auth';

  login(credentials: LoginCredentials): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/login`, {
      username: credentials.username,
      password: credentials.password,
      expiresInMins: 30,
    });
  }

  refreshToken(refreshToken: string): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${this.baseUrl}/refresh`, {
      refreshToken,
      expiresInMins: 30,
    });
  }
}
```

### The Store

```typescript
// libs/state/core/src/lib/auth/auth.store.ts

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
```

### Design Decisions

| Decision | Why |
|----------|-----|
| `providedIn: 'root'` | Singleton across the app and all MF remotes (via webpack singleton sharing). |
| `withDevtools('auth')` before `withState` | DevTools must observe all state additions. |
| `withCallState()` (unnamed) | Auth has one async operation at a time (login or refresh), so a single `callState` suffices. |
| `switchMap` for `login` | If the user submits twice, cancel the first login and use the second. |
| `exhaustMap` for `refreshAccessToken` | If multiple 401 responses trigger refresh simultaneously, only process the first. Ignore duplicates until it completes. |
| `EMPTY` when no refresh token | Guard clause: if there is no token to refresh, do nothing. `EMPTY` completes immediately without emitting. |
| Manual logout reset (not `withReset`) | We want a custom DevTools label ("logout") and we only reset auth-specific state, not callState. |
| `error?.error?.message` fallback chain | HTTP errors from Angular wrap the server error in `error.error`. The fallback chain handles both HTTP and non-HTTP errors. |

---

## 6.2 UserStore: Cross-Store Reactivity

The `UserStore` loads the user profile when authentication succeeds and clears it on logout. It demonstrates the cross-store reactivity pattern.

```typescript
// libs/state/core/src/lib/user/user.store.ts

import { computed, effect, inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, withHooks } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { withDevtools, withCallState, setLoading, setLoaded, setError, updateState } from '@angular-architects/ngrx-toolkit';
import { pipe, switchMap, tap } from 'rxjs';
import { UserService } from './user.service';
import { UserProfile } from './user.model';
import { AuthStore } from '../auth/auth.store';

interface UserState {
  profile: UserProfile | null;
}

const initialUserState: UserState = {
  profile: null,
};

export const UserStore = signalStore(
  { providedIn: 'root' },
  withDevtools('user'),
  withState(initialUserState),
  withCallState(),
  withComputed((store) => ({
    displayName: computed(() => {
      const p = store.profile();
      return p ? `${p.firstName} ${p.lastName}` : '';
    }),
  })),
  withMethods((store) => {
    const userService = inject(UserService);

    return {
      loadUser: rxMethod<number>(
        pipe(
          tap(() => updateState(store, 'load user', setLoading())),
          switchMap((userId) =>
            userService.getProfile(userId).pipe(
              tap({
                next: (profile) =>
                  updateState(store, 'load user success', {
                    profile,
                    ...setLoaded(),
                  }),
                error: (error) =>
                  updateState(
                    store,
                    'load user error',
                    setError(error?.message ?? 'Failed to load user')
                  ),
              })
            )
          )
        )
      ),

      clear(): void {
        updateState(store, 'clear user', initialUserState);
      },
    };
  }),
  withHooks({
    onInit(store) {
      const authStore = inject(AuthStore);

      effect(() => {
        const userId = authStore.userId();
        if (userId) {
          store.loadUser(userId);
        } else {
          store.clear();
        }
      });
    },
  })
);
```

### The Cross-Store Pattern Explained

```
AuthStore.userId() ──► effect() in UserStore.onInit ──► loadUser() or clear()
```

1. **`inject(AuthStore)` in `onInit`**: The `onInit` hook runs in an injection context, so `inject()` works. Both stores are `providedIn: 'root'` and shared via webpack singleton, so this is the same `AuthStore` instance.

2. **`effect()` tracks `authStore.userId()`**: Angular's `effect()` automatically detects which signals are read during execution. When `userId` changes (login sets it to a number, logout sets it to `null`), the effect re-runs.

3. **Branching on `userId`**: If `userId` is truthy, load the profile. If falsy (null after logout), clear the user state.

### Why Not rxMethod with a Signal?

An alternative pattern would be:

```typescript
// Alternative: pass the signal directly to rxMethod
store.loadUser(authStore.userId);
```

This works for loading, but does not handle the logout case (clearing the store when `userId` becomes `null`). The `effect()` pattern allows branching logic.

---

## 6.3 AppStore: Lightweight Flags

Not every store needs HTTP calls or entities. The `AppStore` manages simple synchronous flags.

```typescript
// libs/state/core/src/lib/app/app.store.ts

import { computed } from '@angular/core';
import { signalStore, withState, withComputed, withMethods } from '@ngrx/signals';
import { withDevtools, updateState } from '@angular-architects/ngrx-toolkit';

interface AppState {
  initialized: boolean;
  maintenanceMode: boolean;
  version: string;
}

const initialAppState: AppState = {
  initialized: false,
  maintenanceMode: false,
  version: '0.0.0',
};

export const AppStore = signalStore(
  { providedIn: 'root' },
  withDevtools('app'),
  withState(initialAppState),
  withComputed((store) => ({
    isReady: computed(() => store.initialized() && !store.maintenanceMode()),
  })),
  withMethods((store) => ({
    markInitialized(): void {
      updateState(store, 'mark initialized', { initialized: true });
    },
    setMaintenanceMode(enabled: boolean): void {
      updateState(store, 'set maintenance mode', { maintenanceMode: enabled });
    },
    setVersion(version: string): void {
      updateState(store, 'set version', { version });
    },
  }))
);
```

### Design Decisions

| Decision | Why |
|----------|-----|
| No `withCallState` | No async operations. All state changes are synchronous. |
| No `rxMethod` | No HTTP calls. All methods are plain synchronous functions. |
| No `withHooks` | No initialization logic needed. `markInitialized()` is called externally (e.g., from `APP_INITIALIZER`). |
| `isReady` computed | Combines two flags into a single signal for template use: `@if (appStore.isReady()) { ... }`. |

This store demonstrates that `signalStore` is lightweight. Not every store needs the full feature set. Use only what you need.

---

## 6.4 Feature Store CRUD: OrdersStore

Feature stores are scoped to a specific remote and provided at the route level (not `providedIn: 'root'`). The `OrdersStore` shows the standard pattern for entity-based feature stores.

```typescript
// libs/feature/orders/state/src/lib/orders.store.ts

import { computed, effect, inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, withHooks } from '@ngrx/signals';
import { withEntities, setAllEntities } from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { withDevtools, withCallState, setLoading, setLoaded, setError, updateState } from '@angular-architects/ngrx-toolkit';
import { pipe, switchMap, tap } from 'rxjs';
import { Order } from './order.model';
import { OrdersService } from './orders.service';
import { AuthStore } from '@org/state-core';

interface OrdersLocalState {
  selectedId: number | null;
}

export const OrdersStore = signalStore(
  withDevtools('orders'),
  withState<OrdersLocalState>({
    selectedId: null,
  }),
  withEntities<Order>(),
  withCallState(),
  withComputed((store) => ({
    selectedOrder: computed(() => {
      const id = store.selectedId();
      return id ? store.entities().find((e) => e.id === id) ?? null : null;
    }),
    totalCount: computed(() => store.entities().length),
  })),
  withMethods((store) => {
    const ordersService = inject(OrdersService);

    return {
      loadOrders: rxMethod<number>(
        pipe(
          tap(() => updateState(store, 'load orders', setLoading())),
          switchMap((userId) =>
            ordersService.getByUser(userId).pipe(
              tap({
                next: (response) =>
                  updateState(
                    store,
                    'load orders success',
                    setAllEntities(response.carts),
                    setLoaded()
                  ),
                error: (error) =>
                  updateState(
                    store,
                    'load orders error',
                    setError(error?.message ?? 'Failed to load orders')
                  ),
              })
            )
          )
        )
      ),

      selectOrder(id: number | null): void {
        updateState(store, 'select order', { selectedId: id });
      },
    };
  }),
  withHooks({
    onInit(store) {
      const authStore = inject(AuthStore);

      effect(() => {
        const userId = authStore.userId();
        if (userId) {
          store.loadOrders(userId);
        }
      });
    },
  })
);
```

### Design Decisions

| Decision | Why |
|----------|-----|
| No `providedIn` | Feature stores are provided at the route level. When the user navigates away, the injector is destroyed, the store is garbage collected, and `rxMethod` subscriptions are cleaned up. |
| `withEntities<Order>()` | Orders are a collection. `withEntities` provides `entityMap`, `ids`, and the computed `entities` array. |
| `withState` for UI state | `selectedId` is UI state that lives alongside entities. `withEntities` manages the collection; `withState` manages everything else. |
| `selectedOrder` computed | Derives the selected order from `selectedId` and `entities()`. Avoids storing the full object separately (which would go stale). |
| `inject(AuthStore)` in `onInit` | The `AuthStore` is a shared singleton. The orders store reads `userId` to load orders for the current user. |
| `effect()` for auto-loading | When the user navigates to `/orders`, the store is created, `onInit` fires, the effect reads `authStore.userId()`, and orders load automatically. |

### Providing at Route Level

```typescript
// apps/orders/src/app/remote-entry/entry.routes.ts

export const remoteRoutes: Route[] = [
  {
    path: '',
    providers: [OrdersStore],
    component: OrdersListComponent,
  },
];
```

The store is provided here, not in `providedIn: 'root'`. This scopes the store's lifetime to the route.

---

## 6.5 Feature Store with Search and Filtering: ProductsStore

The `ProductsStore` demonstrates a more complex feature store with multiple `rxMethod` operations and categories filtering.

```typescript
// libs/feature/products/state/src/lib/products.store.ts

import { computed, inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, withHooks } from '@ngrx/signals';
import { withEntities, setAllEntities } from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { withDevtools, withCallState, setLoading, setLoaded, setError, updateState } from '@angular-architects/ngrx-toolkit';
import { pipe, switchMap, tap } from 'rxjs';
import { Product } from './product.model';
import { ProductsApiService } from './products.service';

interface ProductsLocalState {
  selectedId: number | null;
  filterCategory: string | null;
  categories: string[];
  searchQuery: string;
  total: number;
}

export const ProductsStore = signalStore(
  withDevtools('products'),
  withState<ProductsLocalState>({
    selectedId: null,
    filterCategory: null,
    categories: [],
    searchQuery: '',
    total: 0,
  }),
  withEntities<Product>(),
  withCallState(),
  withComputed((store) => ({
    selectedProduct: computed(() => {
      const id = store.selectedId();
      return id ? store.entities().find((e) => e.id === id) ?? null : null;
    }),
    filteredProducts: computed(() => {
      const cat = store.filterCategory();
      const entities = store.entities();
      return cat ? entities.filter((e) => e.category === cat) : entities;
    }),
    totalCount: computed(() => store.entities().length),
  })),
  withMethods((store) => {
    const productsService = inject(ProductsApiService);

    return {
      loadProducts: rxMethod<void>(
        pipe(
          tap(() => updateState(store, 'load products', setLoading())),
          switchMap(() =>
            productsService.getAll(30).pipe(
              tap({
                next: (response) =>
                  updateState(
                    store,
                    'load products success',
                    setAllEntities(response.products),
                    { total: response.total, ...setLoaded() }
                  ),
                error: (error) =>
                  updateState(
                    store,
                    'load products error',
                    setError(error?.message ?? 'Failed to load products')
                  ),
              })
            )
          )
        )
      ),

      searchProducts: rxMethod<string>(
        pipe(
          tap((q) => updateState(store, 'search products', { searchQuery: q, ...setLoading() })),
          switchMap((query) =>
            productsService.search(query).pipe(
              tap({
                next: (response) =>
                  updateState(
                    store,
                    'search products success',
                    setAllEntities(response.products),
                    { total: response.total, filterCategory: null, ...setLoaded() }
                  ),
                error: (error) =>
                  updateState(
                    store,
                    'search products error',
                    setError(error?.message ?? 'Search failed')
                  ),
              })
            )
          )
        )
      ),

      loadByCategory: rxMethod<string>(
        pipe(
          tap((cat) => updateState(store, 'load by category', { filterCategory: cat, ...setLoading() })),
          switchMap((category) =>
            productsService.getByCategory(category).pipe(
              tap({
                next: (response) =>
                  updateState(
                    store,
                    'load by category success',
                    setAllEntities(response.products),
                    { total: response.total, ...setLoaded() }
                  ),
                error: (error) =>
                  updateState(
                    store,
                    'load by category error',
                    setError(error?.message ?? 'Failed to load category')
                  ),
              })
            )
          )
        )
      ),

      loadCategories: rxMethod<void>(
        pipe(
          switchMap(() =>
            productsService.getCategories().pipe(
              tap({
                next: (categories) =>
                  updateState(store, 'load categories success', { categories }),
                error: () => { /* categories are non-critical */ },
              })
            )
          )
        )
      ),

      selectProduct(id: number | null): void {
        updateState(store, 'select product', { selectedId: id });
      },
    };
  }),
  withHooks({
    onInit(store) {
      store.loadProducts();
      store.loadCategories();
    },
  })
);
```

### Multiple rxMethod Pattern

This store has four `rxMethod` definitions. Each manages one async workflow. The pattern is consistent:

1. **Set loading** (combine with UI state update if needed, like `searchQuery` or `filterCategory`)
2. **switchMap** to the service call
3. **tap next** to set entities and mark loaded
4. **tap error** to set error state

This consistency makes stores predictable and reviewable. When a new developer reads a store, they know exactly where to look for the loading, success, and error paths.

### Non-Critical Operations

`loadCategories` intentionally swallows errors. Categories enhance the UI but are not required. If the category list fails to load, the product grid still works. The empty error handler (`() => {}`) is a deliberate design choice, not a bug.

### Auto-Loading in onInit

```typescript
withHooks({
  onInit(store) {
    store.loadProducts();
    store.loadCategories();
  },
})
```

Unlike `OrdersStore` (which uses `effect()` to react to `authStore.userId`), the `ProductsStore` loads unconditionally on init. Products are public data; no authentication is required.

---

## 6.6 CartStore: Events and Cross-Remote Communication

The `CartStore` is the most architecturally interesting store. It combines `withEntities`, `withEventHandlers`, and cross-store reactivity.

### The Event Definitions

```typescript
// libs/state/core/src/lib/cart-events/cart.events.ts

import { type } from '@ngrx/signals';
import { eventGroup } from '@ngrx/signals/events';

export interface CartProduct {
  id: number;
  title: string;
  price: number;
  thumbnail: string;
  discountPercentage: number;
}

export const cartEvents = eventGroup({
  source: 'Cart',
  events: {
    addToCart: type<CartProduct>(),
    removeFromCart: type<{ id: number }>(),
    clearCart: type<void>(),
  },
});
```

**Why events here?** The "add to cart" action originates in the products remote but modifies state in the cart store. Direct injection would create a compile-time dependency between the products remote and the cart state. Events decouple them: the products remote dispatches an event through `@org/state-core` (which is shared), and the cart store handles it.

### The Store

```typescript
// libs/feature/cart/state/src/lib/cart.store.ts

import { computed, effect, inject } from '@angular/core';
import { signalStore, withComputed, withMethods, withHooks } from '@ngrx/signals';
import { withEntities, setAllEntities, addEntity, updateEntity, removeEntity, removeAllEntities } from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { Events, withEventHandlers } from '@ngrx/signals/events';
import { withDevtools, withCallState, setLoading, setLoaded, setError, updateState } from '@angular-architects/ngrx-toolkit';
import { pipe, switchMap, tap, map } from 'rxjs';
import { CartItem } from './cart.model';
import { CartService } from './cart.service';
import { AuthStore, cartEvents } from '@org/state-core';

export const CartStore = signalStore(
  { providedIn: 'root' },
  withDevtools('cart'),
  withEntities<CartItem>(),
  withCallState(),
  withComputed((store) => ({
    totalItems: computed(() =>
      store.entities().reduce((sum, item) => sum + item.quantity, 0)
    ),
    totalPrice: computed(() =>
      store.entities().reduce((sum, item) => sum + item.total, 0)
    ),
    totalDiscountedPrice: computed(() =>
      store.entities().reduce((sum, item) => sum + item.discountedTotal, 0)
    ),
    itemCount: computed(() => store.entities().length),
  })),
  withMethods((store) => {
    const cartService = inject(CartService);

    return {
      loadCart: rxMethod<number>(
        pipe(
          tap(() => updateState(store, 'load cart', setLoading())),
          switchMap((userId) =>
            cartService.getUserCarts(userId).pipe(
              map((response) => response.carts[0] ?? null),
              tap({
                next: (cart) => {
                  if (cart) {
                    updateState(
                      store,
                      'load cart success',
                      setAllEntities(cart.products),
                      setLoaded()
                    );
                  } else {
                    updateState(
                      store,
                      'no cart found',
                      removeAllEntities(),
                      setLoaded()
                    );
                  }
                },
                error: (error) =>
                  updateState(
                    store,
                    'load cart error',
                    setError(error?.message ?? 'Failed to load cart')
                  ),
              })
            )
          )
        )
      ),
    };
  }),
  withEventHandlers((store, events = inject(Events)) => ({
    onAddToCart$: events.on(cartEvents.addToCart).pipe(
      tap(({ payload: product }) => {
        const existing = store.entityMap()[product.id];
        if (existing) {
          const quantity = existing.quantity + 1;
          const total = quantity * product.price;
          const discountedTotal = total * (1 - product.discountPercentage / 100);
          updateState(
            store,
            'add to cart (increment)',
            updateEntity<CartItem>({ id: product.id, changes: { quantity, total, discountedTotal } })
          );
        } else {
          const total = product.price;
          const discountedTotal = total * (1 - product.discountPercentage / 100);
          updateState(
            store,
            'add to cart (new item)',
            addEntity<CartItem>({
              id: product.id,
              title: product.title,
              price: product.price,
              quantity: 1,
              total,
              discountPercentage: product.discountPercentage,
              discountedTotal,
              thumbnail: product.thumbnail,
            })
          );
        }
      })
    ),
    onRemoveFromCart$: events.on(cartEvents.removeFromCart).pipe(
      tap(({ payload }) => {
        updateState(store, 'remove from cart', removeEntity(payload.id));
      })
    ),
    onClearCart$: events.on(cartEvents.clearCart).pipe(
      tap(() => {
        updateState(store, 'clear cart', removeAllEntities());
      })
    ),
  })),
  withHooks({
    onInit(store) {
      const authStore = inject(AuthStore);

      effect(() => {
        const userId = authStore.userId();
        if (userId) {
          store.loadCart(userId);
        }
      });
    },
  })
);
```

### Design Decisions

| Decision | Why |
|----------|-----|
| `providedIn: 'root'` | Cart must be accessible from multiple remotes. Unlike other feature stores, it is a singleton. |
| No `withState` | All cart data is in entities. No additional local state needed. |
| `withEventHandlers` | Decouples the products remote from the cart store. Products dispatches events; cart handles them. |
| `store.entityMap()[product.id]` lookup | O(1) lookup to check if the item already exists before adding/incrementing. This is why `withEntities` stores an `entityMap` alongside the `ids` array. |
| `updateEntity` for increment | Updates only the quantity and computed totals for an existing item. Does not replace the entire entity. |
| `addEntity` for new items | Creates a new `CartItem` with quantity 1. |
| Three separate event handlers | Each handler has a descriptive DevTools action name. Combining them would lose that granularity. |

### How Events Are Dispatched

The products remote uses `injectDispatch` to dispatch cart events:

```typescript
// apps/productsMf/src/app/remote-entry/entry.ts

import { Component, inject, computed } from '@angular/core';
import { ProductsStore, Product } from '@org/feature-products-state';
import { cartEvents, CartProduct } from '@org/state-core';
import { injectDispatch } from '@ngrx/signals/events';

@Component({
  // ...
})
export class RemoteEntry {
  readonly store = inject(ProductsStore);
  private readonly dispatch = injectDispatch(cartEvents);

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
}
```

**The flow:**

1. User clicks "Add to Cart" in the products remote.
2. `this.dispatch.addToCart(product)` emits an event.
3. The `Events` service (injected in `CartStore`'s `withEventHandlers`) delivers the event.
4. `onAddToCart$` handler runs, calling `updateEntity` or `addEntity`.
5. Cart state updates. Any component reading `cartStore.entities()` re-renders.

Because `@org/state-core` (which exports `cartEvents`) is a webpack singleton, the `Events` service is shared across all remotes. Events dispatched in the products remote reach the cart store in the cart remote.

*Verified from installed package type definitions: `injectDispatch` is exported from `@ngrx/signals/events`. `Events` is a class exported from `@ngrx/signals/events`. `withEventHandlers` receives `(store, events) => Record<string, Observable>`.*

---

## 6.7 Optimistic Updates Pattern

The stores in this workspace use pessimistic updates (wait for the server, then update UI). When UX demands immediate feedback, use optimistic updates.

### The Pattern

```typescript
import { signalStore, withMethods, withState } from '@ngrx/signals';
import { withEntities, updateEntity } from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { updateState } from '@angular-architects/ngrx-toolkit';
import { pipe, switchMap, tap, catchError, of } from 'rxjs';

// Inside withMethods:
updateOrderStatus: rxMethod<{ id: number; status: string }>(
  pipe(
    tap(({ id, status }) => {
      // 1. Save the current state for rollback
      const previous = store.entityMap()[id];

      // 2. Optimistically update the UI
      updateState(
        store,
        'update status (optimistic)',
        updateEntity({ id, changes: { status } })
      );
    }),
    switchMap(({ id, status }) => {
      const previous = store.entityMap()[id];
      return ordersService.updateStatus(id, status).pipe(
        tap({
          next: () =>
            updateState(store, 'update status confirmed', /* no-op, already updated */),
          error: () => {
            // 3. Rollback on failure
            if (previous) {
              updateState(
                store,
                'update status rollback',
                updateEntity({ id, changes: { status: previous.status } })
              );
            }
          },
        })
      );
    })
  )
),
```

### When to Use Optimistic vs Pessimistic

| Aspect | Optimistic | Pessimistic |
|--------|-----------|-------------|
| UI responsiveness | Instant | Waits for server |
| Error handling | Must rollback on failure | Natural (UI never showed wrong state) |
| Complexity | Higher (save previous state, handle rollback) | Lower (standard pattern) |
| Use when | Toggle, like, reorder, quick edits | Create, delete, payment, anything irreversible |
| Network assumption | Mostly succeeds | No assumption |

**Recommendation:** Default to pessimistic updates (the pattern used throughout this workspace). Add optimistic updates only for specific interactions where latency visibly hurts UX.

---

## 6.8 Error Handling Patterns

### Pattern 1: Per-Method Error via CallState

This is the standard pattern in this workspace. The `callState` tracks a single error:

```typescript
updateState(store, 'load error', setError('Failed to load orders'));
```

Template:

```html
@if (store.error(); as error) {
  <div class="error-banner">
    <p>{{ error }}</p>
    <button (click)="store.loadOrders(userId)">Retry</button>
  </div>
}
```

**Limitation:** Only one error at a time. If `loadOrders` fails, then `selectOrder` succeeds, the error is still visible because `callState` was not reset. This is why successful operations include `...setLoaded()` to clear any previous error.

### Pattern 2: Named CallState for Independent Errors

When multiple operations can fail independently:

```typescript
export const DashboardStore = signalStore(
  withCallState({ collection: 'orders' }),
  withCallState({ collection: 'stats' }),
  withMethods((store) => ({
    loadOrders: rxMethod<void>(
      pipe(
        tap(() => updateState(store, 'load orders', setLoading('orders'))),
        switchMap(() =>
          ordersService.getAll().pipe(
            tap({
              next: () => updateState(store, 'load orders ok', setLoaded('orders')),
              error: (e) => updateState(store, 'load orders fail', setError(e.message, 'orders')),
            })
          )
        )
      )
    ),
    loadStats: rxMethod<void>(
      pipe(
        tap(() => updateState(store, 'load stats', setLoading('stats'))),
        switchMap(() =>
          statsService.get().pipe(
            tap({
              next: () => updateState(store, 'load stats ok', setLoaded('stats')),
              error: (e) => updateState(store, 'load stats fail', setError(e.message, 'stats')),
            })
          )
        )
      )
    ),
  }))
);
```

Template:

```html
@if (store.ordersLoading()) { <spinner /> }
@if (store.ordersError(); as error) { <error [message]="error" /> }

@if (store.statsLoading()) { <spinner /> }
@if (store.statsError(); as error) { <error [message]="error" /> }
```

### Pattern 3: Global Error Handling

For errors that should be shown as a toast or snackbar, handle them in the store method and forward to a global notification service:

```typescript
withMethods((store) => {
  const notifier = inject(NotificationService);

  return {
    loadOrders: rxMethod<number>(
      pipe(
        tap(() => updateState(store, 'load orders', setLoading())),
        switchMap((userId) =>
          ordersService.getByUser(userId).pipe(
            tap({
              next: (response) =>
                updateState(store, 'load orders success', setAllEntities(response.carts), setLoaded()),
              error: (error) => {
                const message = error?.message ?? 'Failed to load orders';
                updateState(store, 'load orders error', setError(message));
                notifier.showError(message); // Global notification
              },
            })
          )
        )
      )
    ),
  };
})
```

---

## 6.9 Component Integration Patterns

### Smart vs Presentational Components

**Smart components** inject stores and orchestrate behavior:

```typescript
@Component({
  template: `
    @if (store.loading()) {
      <app-loading-spinner />
    } @else if (store.error(); as error) {
      <app-error-message [message]="error" />
    } @else if (store.loaded()) {
      <app-product-grid
        [products]="store.filteredProducts()"
        (productSelected)="store.selectProduct($event)"
        (addToCart)="onAddToCart($event)"
      />
    }
  `,
})
export class ProductsPageComponent {
  readonly store = inject(ProductsStore);
  private readonly dispatch = injectDispatch(cartEvents);

  onAddToCart(product: Product): void {
    this.dispatch.addToCart({
      id: product.id,
      title: product.title,
      price: product.price,
      thumbnail: product.thumbnail,
      discountPercentage: product.discountPercentage,
    });
  }
}
```

**Presentational components** receive data via inputs and emit events via outputs. They never inject stores:

```typescript
@Component({
  selector: 'app-product-grid',
  template: `
    @for (product of products(); track product.id) {
      <app-product-card
        [product]="product"
        (addToCart)="addToCart.emit(product)"
      />
    }
  `,
})
export class ProductGridComponent {
  products = input.required<Product[]>();
  productSelected = output<number>();
  addToCart = output<Product>();
}
```

### Store Pattern Decision Matrix

| Store Type | `providedIn` | Entities | CallState | DevTools | Events | Route Providers |
|------------|-------------|----------|-----------|---------|--------|----------------|
| Core (auth, user, app) | `'root'` | No | If async | Yes | No | No |
| Feature (orders, products) | *(omitted)* | Yes | Yes | Yes | No | Yes |
| Shared feature (cart) | `'root'` | Yes | Yes | Yes | Yes (handler) | No |

---

## Summary

- **AuthStore**: Token management with `switchMap` for login, `exhaustMap` for refresh. No entities.
- **UserStore**: Cross-store reactivity via `effect()` watching `authStore.userId()` in `onInit`.
- **AppStore**: Minimal synchronous store. No HTTP, no entities, no callState.
- **OrdersStore**: Standard entity feature store. Scoped to route. Auto-loads via `effect()`.
- **ProductsStore**: Multiple `rxMethod` operations for search, category filter, and initial load.
- **CartStore**: Events-driven via `withEventHandlers`. `providedIn: 'root'` for cross-remote sharing. Uses `entityMap` for O(1) lookups.
- **Optimistic updates**: Save previous state, update UI, rollback on error. Use sparingly.
- **Error handling**: Single `callState` for simple stores, named collections for independent operations, global notifier for toasts.
- **Component pattern**: Smart components inject stores, presentational components receive inputs.

Next: [Chapter 7: Testing State Libraries](./07-testing-state-libraries.md) covers how to unit test each of these patterns.
