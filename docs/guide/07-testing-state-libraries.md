# Chapter 7: Testing State Libraries

> Every store is an Angular service. Test it like one: `TestBed.configureTestingModule`, inject, assert.

This chapter covers unit testing Signal Stores with Vitest and Analog. It shows how to test state transitions, `rxMethod` with mocked HTTP, `withEntities` operations, `withCallState` lifecycle, cross-store reactivity, and event handlers.

---

## 7.1 Test Environment Setup

All state libraries in this workspace use the same test configuration.

### Vitest Configuration

```typescript
// libs/state/core/vite.config.mts

/// <reference types='vitest' />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/libs/state/core',
  plugins: [angular(), nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
  test: {
    name: 'state-core',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    setupFiles: ['src/test-setup.ts'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../coverage/libs/state/core',
      provider: 'v8' as const,
    },
  },
}));
```

Key settings:

| Setting | Value | Why |
|---------|-------|-----|
| `globals: true` | Enables `describe`, `it`, `expect` without imports | Matches Jest conventions, less boilerplate |
| `environment: 'jsdom'` | Simulates browser APIs | Angular needs `document`, `window` |
| `setupFiles` | `['src/test-setup.ts']` | Runs before every test file |

### Test Setup File

```typescript
// libs/state/core/src/test-setup.ts

import '@angular/compiler';
import '@analogjs/vitest-angular/setup-snapshots';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';

setupTestBed({ zoneless: false });
```

`setupTestBed` configures Angular's `TestBed` for Vitest. The `{ zoneless: false }` option uses Zone.js for change detection, matching the production configuration.

### TypeScript Configuration for Tests

```json
// libs/state/core/tsconfig.spec.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../../dist/out-tsc",
    "types": ["vitest/globals", "vitest/importMeta", "vite/client", "node", "vitest"]
  },
  "include": ["src/**/*.spec.ts", "src/**/*.d.ts"],
  "files": ["src/test-setup.ts"]
}
```

### Running Tests

```bash
# Run tests for a specific library
pnpm nx test state-core

# Run tests for all state libraries
pnpm nx run-many -t test -p state-core feature-orders-state feature-products-state feature-cart-state

# Run with coverage
pnpm nx test state-core --coverage
```

---

## 7.2 Testing Stores with TestBed

The basic pattern: configure `TestBed` with the store and mocked dependencies, inject the store, and assert.

### Minimal Test Setup

```typescript
import { TestBed } from '@angular/core/testing';
import { AuthStore } from './auth.store';
import { AuthService } from './auth.service';
import { of, throwError } from 'rxjs';

describe('AuthStore', () => {
  let store: InstanceType<typeof AuthStore>;
  let authServiceMock: { login: ReturnType<typeof vi.fn>; refreshToken: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    authServiceMock = {
      login: vi.fn(),
      refreshToken: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        AuthStore,
        { provide: AuthService, useValue: authServiceMock },
      ],
    });

    store = TestBed.inject(AuthStore);
  });

  it('should start with initial state', () => {
    expect(store.accessToken()).toBeNull();
    expect(store.refreshToken()).toBeNull();
    expect(store.userId()).toBeNull();
    expect(store.isAuthenticated()).toBe(false);
    expect(store.loading()).toBe(false);
    expect(store.loaded()).toBe(false);
    expect(store.error()).toBeNull();
  });
});
```

### Why Provide AuthStore Explicitly?

Even though `AuthStore` has `providedIn: 'root'`, providing it explicitly in `TestBed.configureTestingModule` ensures a fresh instance per test. Without it, the store from a previous test could leak state.

### Mocking Services with vi.fn()

```typescript
const authServiceMock = {
  login: vi.fn(),
  refreshToken: vi.fn(),
};
```

Each method is a Vitest mock function (`vi.fn()`). In individual tests, configure what they return:

```typescript
authServiceMock.login.mockReturnValue(of({
  id: 1,
  accessToken: 'token-123',
  refreshToken: 'refresh-456',
  // ... other fields
}));
```

---

## 7.3 Testing State Transitions

### Testing Synchronous Methods

```typescript
describe('logout', () => {
  it('should reset state to initial values', () => {
    // Arrange: put the store in a logged-in state using unprotected
    const { patchState } = await import('@ngrx/signals');
    const { unprotected } = await import('@ngrx/signals/testing');

    patchState(unprotected(store), {
      accessToken: 'token-123',
      refreshToken: 'refresh-456',
      userId: 1,
    });
    expect(store.isAuthenticated()).toBe(true);

    // Act
    store.logout();

    // Assert
    expect(store.accessToken()).toBeNull();
    expect(store.refreshToken()).toBeNull();
    expect(store.userId()).toBeNull();
    expect(store.isAuthenticated()).toBe(false);
  });
});
```

### Testing Computed Signals

```typescript
describe('isAuthenticated', () => {
  it('should be true when accessToken is set', () => {
    const { patchState } = await import('@ngrx/signals');
    const { unprotected } = await import('@ngrx/signals/testing');

    patchState(unprotected(store), { accessToken: 'token-123' });
    expect(store.isAuthenticated()).toBe(true);
  });

  it('should be false when accessToken is null', () => {
    expect(store.isAuthenticated()).toBe(false);
  });
});
```

---

## 7.4 The unprotected() Helper

Signal Store state is read-only from outside the store. You cannot call `patchState(store, { ... })` in a test because the store is a `StateSource`, not a `WritableStateSource`. The `unprotected()` helper from `@ngrx/signals/testing` converts the store to a `WritableStateSource`, allowing direct state manipulation in tests.

```typescript
import { patchState } from '@ngrx/signals';
import { unprotected } from '@ngrx/signals/testing';

// This works in tests:
patchState(unprotected(store), { accessToken: 'test-token' });

// This would NOT work (TypeScript error):
// patchState(store, { accessToken: 'test-token' });
```

### When to Use unprotected()

| Scenario | Use unprotected()? |
|----------|-------------------|
| Setting up preconditions (arrange phase) | Yes |
| Testing that a method produces the right state | No (call the method, then read signals) |
| Force-setting callState for computed signal tests | Yes |
| Testing entity operations | Yes (for setup), No (for verification) |

**Do NOT use `unprotected()` in production code.** It exists only in `@ngrx/signals/testing` and is intended for test setup.

*Verified from installed package type definitions: `unprotected<Source extends StateSource<object>>(source: Source): UnprotectedSource<Source>` converts `StateSource` to `WritableStateSource`.*

Sources: [Testing - NgRx Signal Store](https://ngrx.io/guide/signals/signal-store/testing)

---

## 7.5 Testing rxMethod with Mocked HTTP

`rxMethod` creates reactive methods that pipe through RxJS operators. Testing them requires controlling what the mocked service returns and then verifying the store's state after the async operation completes.

### Testing the Login Happy Path

```typescript
describe('login', () => {
  it('should set tokens and userId on successful login', async () => {
    const mockResponse = {
      id: 42,
      username: 'testuser',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      image: '',
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-456',
    };
    authServiceMock.login.mockReturnValue(of(mockResponse));

    store.login({ username: 'testuser', password: 'password' });

    // Allow microtasks to complete (rxMethod uses async scheduling)
    await TestBed.inject(ApplicationRef).whenStable();

    expect(store.accessToken()).toBe('access-token-123');
    expect(store.refreshToken()).toBe('refresh-token-456');
    expect(store.userId()).toBe(42);
    expect(store.isAuthenticated()).toBe(true);
    expect(store.loaded()).toBe(true);
    expect(store.loading()).toBe(false);
  });
});
```

### Testing the Login Error Path

```typescript
describe('login error', () => {
  it('should set error state on failed login', async () => {
    authServiceMock.login.mockReturnValue(
      throwError(() => ({ message: 'Invalid credentials' }))
    );

    store.login({ username: 'wrong', password: 'wrong' });

    await TestBed.inject(ApplicationRef).whenStable();

    expect(store.error()).toBe('Invalid credentials');
    expect(store.loading()).toBe(false);
    expect(store.isAuthenticated()).toBe(false);
  });
});
```

### Testing Loading State

```typescript
import { Subject } from 'rxjs';

describe('login loading state', () => {
  it('should set loading to true while request is in flight', () => {
    const loginSubject = new Subject();
    authServiceMock.login.mockReturnValue(loginSubject.asObservable());

    store.login({ username: 'testuser', password: 'password' });

    // Request is in flight
    expect(store.loading()).toBe(true);
    expect(store.loaded()).toBe(false);

    // Complete the request
    loginSubject.next({
      id: 1,
      accessToken: 'token',
      refreshToken: 'refresh',
    });
    loginSubject.complete();
  });
});
```

Using a `Subject` gives you control over when the observable emits. This lets you assert the intermediate loading state before the response arrives.

### Awaiting Async Operations

`rxMethod` uses RxJS internally. When the mocked service returns `of(value)` (which emits synchronously), the state updates happen during the same microtask. However, Angular's effect scheduling may still defer some updates. Use one of these approaches:

```typescript
// Option 1: ApplicationRef.whenStable()
await TestBed.inject(ApplicationRef).whenStable();

// Option 2: Wrap in a TestBed.runInInjectionContext + flush
TestBed.flushEffects();
```

For tests where the service returns a synchronous observable (`of(...)`), you can often assert immediately. For tests using `Subject` or `delay`, use `whenStable()`.

---

## 7.6 Testing withEntities

### Testing Entity Operations

```typescript
import { TestBed } from '@angular/core/testing';
import { ApplicationRef } from '@angular/core';
import { ProductsStore } from './products.store';
import { ProductsApiService } from './products.service';
import { of } from 'rxjs';
import { patchState } from '@ngrx/signals';
import { unprotected } from '@ngrx/signals/testing';
import { setAllEntities, addEntity, removeEntity } from '@ngrx/signals/entities';

describe('ProductsStore entities', () => {
  let store: InstanceType<typeof ProductsStore>;
  let serviceMock: { getAll: ReturnType<typeof vi.fn>; /* ... */ };

  const mockProducts = [
    { id: 1, title: 'Laptop', category: 'electronics', price: 999 },
    { id: 2, title: 'Phone', category: 'electronics', price: 699 },
    { id: 3, title: 'Shirt', category: 'clothing', price: 29 },
  ];

  beforeEach(() => {
    serviceMock = {
      getAll: vi.fn().mockReturnValue(of({ products: mockProducts, total: 3 })),
      search: vi.fn(),
      getByCategory: vi.fn(),
      getCategories: vi.fn().mockReturnValue(of([])),
    };

    TestBed.configureTestingModule({
      providers: [
        ProductsStore,
        { provide: ProductsApiService, useValue: serviceMock },
      ],
    });

    store = TestBed.inject(ProductsStore);
  });

  it('should load entities via loadProducts', async () => {
    // onInit calls loadProducts automatically
    await TestBed.inject(ApplicationRef).whenStable();

    expect(store.entities().length).toBe(3);
    expect(store.entities()[0].title).toBe('Laptop');
    expect(store.totalCount()).toBe(3);
  });

  it('should populate entityMap for O(1) lookups', async () => {
    await TestBed.inject(ApplicationRef).whenStable();

    const entityMap = store.entityMap();
    expect(entityMap[1].title).toBe('Laptop');
    expect(entityMap[2].title).toBe('Phone');
    expect(entityMap[99]).toBeUndefined();
  });

  it('should replace entities on setAllEntities', () => {
    // Directly set entities using unprotected for setup
    patchState(
      unprotected(store),
      setAllEntities([
        { id: 10, title: 'New Product', category: 'test', price: 50 },
      ])
    );

    expect(store.entities().length).toBe(1);
    expect(store.entities()[0].id).toBe(10);
  });
});
```

### Testing Computed Derived from Entities

```typescript
describe('selectedProduct computed', () => {
  it('should return the selected product', async () => {
    await TestBed.inject(ApplicationRef).whenStable();

    store.selectProduct(2);

    expect(store.selectedProduct()).toEqual(
      expect.objectContaining({ id: 2, title: 'Phone' })
    );
  });

  it('should return null when no product is selected', () => {
    expect(store.selectedProduct()).toBeNull();
  });

  it('should return null when selectedId does not match any entity', async () => {
    await TestBed.inject(ApplicationRef).whenStable();

    store.selectProduct(999);

    expect(store.selectedProduct()).toBeNull();
  });
});
```

---

## 7.7 Testing withCallState Transitions

### The Full Lifecycle

```typescript
import { Subject } from 'rxjs';

describe('callState transitions', () => {
  it('should follow init -> loading -> loaded', async () => {
    const responseSubject = new Subject();
    serviceMock.getAll.mockReturnValue(responseSubject.asObservable());

    // Initial state
    expect(store.loading()).toBe(false);
    expect(store.loaded()).toBe(false);
    expect(store.error()).toBeNull();

    // Trigger load (onInit already called it, but let's be explicit)
    store.loadProducts();

    // Loading
    expect(store.loading()).toBe(true);
    expect(store.loaded()).toBe(false);

    // Server responds
    responseSubject.next({ products: mockProducts, total: 3 });
    responseSubject.complete();

    // Loaded
    expect(store.loading()).toBe(false);
    expect(store.loaded()).toBe(true);
    expect(store.error()).toBeNull();
  });

  it('should follow init -> loading -> error', async () => {
    const responseSubject = new Subject();
    serviceMock.getAll.mockReturnValue(responseSubject.asObservable());

    store.loadProducts();
    expect(store.loading()).toBe(true);

    // Server responds with error
    responseSubject.error({ message: 'Network timeout' });

    expect(store.loading()).toBe(false);
    expect(store.loaded()).toBe(false);
    expect(store.error()).toBe('Network timeout');
  });
});
```

### Force-Setting CallState with unprotected

When testing computed signals that depend on callState, use `unprotected()` to force a specific state:

```typescript
it('should expose error message from callState', () => {
  patchState(unprotected(store), {
    callState: { error: 'Something broke' },
  });

  expect(store.error()).toBe('Something broke');
  expect(store.loading()).toBe(false);
  expect(store.loaded()).toBe(false);
});
```

---

## 7.8 Testing Cross-Store Reactivity

When `UserStore` depends on `AuthStore` via `effect()`, mock the `AuthStore` in the test.

```typescript
import { TestBed } from '@angular/core/testing';
import { ApplicationRef, signal } from '@angular/core';
import { UserStore } from './user.store';
import { UserService } from './user.service';
import { AuthStore } from '../auth/auth.store';
import { of } from 'rxjs';

describe('UserStore cross-store reactivity', () => {
  let store: InstanceType<typeof UserStore>;
  let userServiceMock: { getProfile: ReturnType<typeof vi.fn> };

  // Create a mock AuthStore with writable signals
  const authStoreMock = {
    userId: signal<number | null>(null),
    isAuthenticated: signal(false),
    accessToken: signal<string | null>(null),
  };

  const mockProfile = {
    firstName: 'Alice',
    lastName: 'Smith',
    email: 'alice@example.com',
  };

  beforeEach(() => {
    userServiceMock = {
      getProfile: vi.fn().mockReturnValue(of(mockProfile)),
    };

    // Reset mock signals
    authStoreMock.userId.set(null);
    authStoreMock.isAuthenticated.set(false);

    TestBed.configureTestingModule({
      providers: [
        UserStore,
        { provide: UserService, useValue: userServiceMock },
        { provide: AuthStore, useValue: authStoreMock },
      ],
    });

    store = TestBed.inject(UserStore);
  });

  it('should load user profile when userId becomes available', async () => {
    // Simulate login
    authStoreMock.userId.set(42);

    await TestBed.inject(ApplicationRef).whenStable();

    expect(userServiceMock.getProfile).toHaveBeenCalledWith(42);
    expect(store.profile()).toEqual(mockProfile);
    expect(store.displayName()).toBe('Alice Smith');
  });

  it('should clear profile when userId becomes null', async () => {
    // First, simulate login
    authStoreMock.userId.set(42);
    await TestBed.inject(ApplicationRef).whenStable();
    expect(store.profile()).not.toBeNull();

    // Then, simulate logout
    authStoreMock.userId.set(null);
    await TestBed.inject(ApplicationRef).whenStable();

    expect(store.profile()).toBeNull();
    expect(store.displayName()).toBe('');
  });

  it('should not call service when userId is null on init', async () => {
    await TestBed.inject(ApplicationRef).whenStable();

    expect(userServiceMock.getProfile).not.toHaveBeenCalled();
    expect(store.profile()).toBeNull();
  });
});
```

### The Mock AuthStore Pattern

The mock uses plain Angular `signal()` functions instead of a real `AuthStore`:

```typescript
const authStoreMock = {
  userId: signal<number | null>(null),
  isAuthenticated: signal(false),
  accessToken: signal<string | null>(null),
};
```

This works because the `UserStore` only reads `authStore.userId()` inside `effect()`. Angular's signal system does not care whether the signal came from a `signalStore` or a plain `signal()`. Structural typing makes the mock compatible.

To simulate login/logout in a test, call `authStoreMock.userId.set(42)` or `authStoreMock.userId.set(null)`. The `effect()` in `UserStore.onInit` will react.

---

## 7.9 Testing withEventHandlers

Testing event-driven stores requires providing the `Events` service and a `Dispatcher` to dispatch events in the test.

```typescript
import { TestBed } from '@angular/core/testing';
import { ApplicationRef, signal } from '@angular/core';
import { provideDispatcher, injectDispatch } from '@ngrx/signals/events';
import { CartStore } from './cart.store';
import { CartService } from './cart.service';
import { AuthStore, cartEvents } from '@org/state-core';
import { of } from 'rxjs';

describe('CartStore event handlers', () => {
  let store: InstanceType<typeof CartStore>;
  let dispatch: ReturnType<typeof injectDispatch<typeof cartEvents>>;

  const authStoreMock = {
    userId: signal<number | null>(null),
    isAuthenticated: signal(false),
    accessToken: signal<string | null>(null),
  };

  const cartServiceMock = {
    getUserCarts: vi.fn().mockReturnValue(of({ carts: [] })),
  };

  beforeEach(() => {
    authStoreMock.userId.set(null);

    TestBed.configureTestingModule({
      providers: [
        CartStore,
        provideDispatcher(),
        { provide: CartService, useValue: cartServiceMock },
        { provide: AuthStore, useValue: authStoreMock },
      ],
    });

    store = TestBed.inject(CartStore);

    // Get the dispatcher within the injection context
    TestBed.runInInjectionContext(() => {
      dispatch = injectDispatch(cartEvents);
    });
  });

  describe('addToCart event', () => {
    const product = {
      id: 1,
      title: 'Laptop',
      price: 999,
      thumbnail: 'laptop.jpg',
      discountPercentage: 10,
    };

    it('should add a new item to the cart', async () => {
      dispatch.addToCart(product);
      await TestBed.inject(ApplicationRef).whenStable();

      expect(store.entities().length).toBe(1);
      expect(store.entities()[0]).toEqual(
        expect.objectContaining({
          id: 1,
          title: 'Laptop',
          price: 999,
          quantity: 1,
          total: 999,
          discountedTotal: expect.closeTo(899.1, 1),
        })
      );
    });

    it('should increment quantity for existing item', async () => {
      dispatch.addToCart(product);
      await TestBed.inject(ApplicationRef).whenStable();

      dispatch.addToCart(product);
      await TestBed.inject(ApplicationRef).whenStable();

      expect(store.entities().length).toBe(1);
      expect(store.entities()[0].quantity).toBe(2);
      expect(store.entities()[0].total).toBe(1998);
    });
  });

  describe('removeFromCart event', () => {
    it('should remove item by id', async () => {
      // Add item first
      dispatch.addToCart({
        id: 1,
        title: 'Laptop',
        price: 999,
        thumbnail: 'laptop.jpg',
        discountPercentage: 0,
      });
      await TestBed.inject(ApplicationRef).whenStable();
      expect(store.entities().length).toBe(1);

      // Remove it
      dispatch.removeFromCart({ id: 1 });
      await TestBed.inject(ApplicationRef).whenStable();

      expect(store.entities().length).toBe(0);
    });
  });

  describe('clearCart event', () => {
    it('should remove all items', async () => {
      dispatch.addToCart({
        id: 1, title: 'A', price: 10, thumbnail: '', discountPercentage: 0,
      });
      dispatch.addToCart({
        id: 2, title: 'B', price: 20, thumbnail: '', discountPercentage: 0,
      });
      await TestBed.inject(ApplicationRef).whenStable();
      expect(store.entities().length).toBe(2);

      dispatch.clearCart();
      await TestBed.inject(ApplicationRef).whenStable();

      expect(store.entities().length).toBe(0);
    });
  });

  describe('computed signals', () => {
    it('should compute totalItems from entity quantities', async () => {
      dispatch.addToCart({
        id: 1, title: 'A', price: 10, thumbnail: '', discountPercentage: 0,
      });
      dispatch.addToCart({
        id: 1, title: 'A', price: 10, thumbnail: '', discountPercentage: 0,
      }); // Same item, quantity becomes 2
      dispatch.addToCart({
        id: 2, title: 'B', price: 20, thumbnail: '', discountPercentage: 0,
      });
      await TestBed.inject(ApplicationRef).whenStable();

      expect(store.totalItems()).toBe(3); // 2 + 1
      expect(store.itemCount()).toBe(2);  // 2 unique items
    });
  });
});
```

### Key Setup Details

1. **`provideDispatcher()`**: Required in the test's `providers`. This sets up the `Dispatcher` and `Events` services that `withEventHandlers` needs.

2. **`TestBed.runInInjectionContext`**: `injectDispatch` must be called inside an injection context. `TestBed.runInInjectionContext` provides that.

3. **`dispatch.addToCart(product)`**: Dispatches an event that the `CartStore`'s `withEventHandlers` picks up. The event flows through the same `Events` service the store subscribes to.

*Verified from installed package type definitions: `provideDispatcher(): Provider[]` and `injectDispatch<EventGroup>(events: EventGroup)` are exported from `@ngrx/signals/events`.*

---

## 7.10 Testing Custom signalStoreFeature

When you build reusable features with `signalStoreFeature`, test them by composing a minimal test store.

```typescript
import { TestBed } from '@angular/core/testing';
import { signalStore, withState } from '@ngrx/signals';
import { patchState } from '@ngrx/signals';
import { unprotected } from '@ngrx/signals/testing';
import { withLoadingState } from './with-loading-state'; // Your custom feature

describe('withLoadingState custom feature', () => {
  // Create a minimal store that uses the feature
  const TestStore = signalStore(
    withState({ items: [] as string[] }),
    withLoadingState('test-store'),
  );

  let store: InstanceType<typeof TestStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TestStore],
    });

    store = TestBed.inject(TestStore);
  });

  it('should add callState signals', () => {
    expect(store.loading()).toBe(false);
    expect(store.loaded()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('should track loading state', () => {
    patchState(unprotected(store), { callState: 'loading' });

    expect(store.loading()).toBe(true);
    expect(store.loaded()).toBe(false);
  });
});
```

This pattern isolates the custom feature from any specific store. If the feature works with the minimal test store, it will work with any store that meets its type constraints.

---

## 7.11 Common Testing Patterns

### Pattern: Arrange-Act-Assert with Signals

```typescript
it('should filter products by category', async () => {
  // Arrange: load products
  await TestBed.inject(ApplicationRef).whenStable();
  expect(store.entities().length).toBe(3);

  // Act: filter by category
  store.loadByCategory('electronics');
  serviceMock.getByCategory.mockReturnValue(
    of({ products: mockProducts.filter(p => p.category === 'electronics'), total: 2 })
  );
  await TestBed.inject(ApplicationRef).whenStable();

  // Assert: only electronics remain
  expect(store.entities().length).toBe(2);
  expect(store.entities().every(p => p.category === 'electronics')).toBe(true);
});
```

### Pattern: Testing Multiple Operations in Sequence

```typescript
it('should handle login then load user profile', async () => {
  // Login
  authServiceMock.login.mockReturnValue(of({
    id: 1, accessToken: 'token', refreshToken: 'refresh',
    username: 'test', email: '', firstName: '', lastName: '', image: '',
  }));
  authStore.login({ username: 'test', password: 'pass' });
  await TestBed.inject(ApplicationRef).whenStable();

  // UserStore should have reacted
  expect(userServiceMock.getProfile).toHaveBeenCalledWith(1);
});
```

### Pattern: Testing That a Method Was NOT Called

```typescript
it('should not load user when userId is null', async () => {
  authStoreMock.userId.set(null);
  await TestBed.inject(ApplicationRef).whenStable();

  expect(userServiceMock.getProfile).not.toHaveBeenCalled();
});
```

### Test Checklist by Feature

| Feature | What to Test | Key Assertions |
|---------|-------------|----------------|
| `withState` | Initial state values | `store.prop()` equals initial value |
| `withComputed` | Derived signals update when dependencies change | Set state via `unprotected`, check computed |
| `withMethods` (sync) | State changes after method call | Call method, read signals |
| `rxMethod` | Happy path, error path, loading state | Mock service, check callState and state |
| `withEntities` | CRUD operations | `entities().length`, `entityMap()[id]` |
| `withCallState` | init -> loading -> loaded/error | `loading()`, `loaded()`, `error()` |
| `withHooks` (onInit) | Auto-loading, cross-store effects | Mock dependencies, verify method calls |
| `withEventHandlers` | Event -> state change | Dispatch event, check entity state |
| Custom feature | Feature behavior in isolation | Create test store, verify feature API |

---

## Summary

- **Test infrastructure:** Vitest + Analog + jsdom. Configuration is identical across all state libraries.
- **`TestBed.configureTestingModule`** with the store and mocked services. Always provide the store explicitly for test isolation.
- **`unprotected()`** from `@ngrx/signals/testing` converts the store to writable for test setup. Never use in production code.
- **`vi.fn()`** for mocking services. Return `of(value)` for success, `throwError()` for failure, `Subject` for controlling timing.
- **`ApplicationRef.whenStable()`** to await async operations from `rxMethod`.
- **Cross-store tests:** Mock the dependency store with plain `signal()` functions. Set signal values to simulate login/logout.
- **Event handler tests:** Provide `provideDispatcher()`, get a dispatcher via `TestBed.runInInjectionContext(() => injectDispatch(events))`, and dispatch events.
- **Custom features:** Create a minimal test store with `signalStore(withState(...), yourFeature())`.

Next: [Chapter 8: DevOps and Scaling](./08-devops-and-scaling.md) covers CI pipelines, `nx affected`, and adding new remotes.
