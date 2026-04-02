# Chapter 4: NgRx Signal Store Deep Dive

> Every API in `@ngrx/signals` v21.1.0, explained with production context and verified against the installed type definitions.

This chapter is the reference. It covers every public function and type exported from `@ngrx/signals`, its `entities`, `rxjs-interop`, and `testing` entry points, plus the `updateState` wrapper from `@angular-architects/ngrx-toolkit` that this workspace uses instead of bare `patchState`.

---

## 4.1 signalStore() Factory

`signalStore()` generates an injectable Angular service class. It accepts an optional config object and up to 15 feature functions.

```typescript
import { signalStore, withState, withMethods } from '@ngrx/signals';

export const CounterStore = signalStore(
  withState({ count: 0 }),
  withMethods((store) => ({
    increment(): void {
      patchState(store, ({ count }) => ({ count: count + 1 }));
    },
  }))
);
```

### Config Object

The first argument can optionally be a config object with a `providedIn` property:

```typescript
export const AuthStore = signalStore(
  { providedIn: 'root' },
  // ... features
);
```

| `providedIn` Value | Behavior |
|-------------------|----------|
| `'root'` | Singleton in the root injector. Use for core stores (auth, user, app). |
| `'platform'` | Singleton shared across multiple Angular apps on the same page. Rare. |
| *(omitted)* | Not tree-shakable. Must be explicitly provided in a `providers` array (route, component, or module). Use for feature stores. |

*Verified from installed package type definitions: `signalStore` accepts `ProvidedInConfig` as `{ providedIn?: 'root' | 'platform' }`, and supports 1 to 15 feature arguments.*

### Feature Composition Order

Features are applied left to right. Each feature can access the state, props, and methods added by features before it. This means `withComputed` can access signals from `withState`, and `withMethods` can access both.

```typescript
export const Store = signalStore(
  withState({ count: 0 }),              // Adds: count signal
  withComputed((store) => ({            // Can read: store.count()
    doubled: computed(() => store.count() * 2),
  })),
  withMethods((store) => ({             // Can read: store.count(), store.doubled()
    reset(): void {
      patchState(store, { count: 0 });
    },
  })),
  withHooks({
    onInit(store) {                     // Can read: store.count(), store.doubled(), store.reset()
      console.log('Initial count:', store.count());
    },
  })
);
```

If you reference a signal from a later feature, TypeScript will produce a type error. This is by design: it prevents circular dependencies within the store.

### What signalStore Returns

`signalStore()` returns an Angular `Type<T>` (a class constructor). The instance has:

- **State signals:** One signal per state property (e.g., `store.count()`). Nested objects become `DeepSignal`s.
- **Props:** Custom properties from `withComputed` and `withProps` (e.g., `store.doubled()`).
- **Methods:** Functions from `withMethods` (e.g., `store.increment()`).
- **StateSource:** The store implements `StateSource<State>`, which is required by `patchState`, `getState`, and `watchState`.

---

## 4.2 withState(initialState)

Adds managed state to the store. Each property becomes a deeply reactive signal.

```typescript
import { signalStore, withState } from '@ngrx/signals';

interface ProductsState {
  selectedId: number | null;
  filterCategory: string | null;
  categories: string[];
  searchQuery: string;
  total: number;
}

export const ProductsStore = signalStore(
  withState<ProductsState>({
    selectedId: null,
    filterCategory: null,
    categories: [],
    searchQuery: '',
    total: 0,
  }),
  // store.selectedId() is Signal<number | null>
  // store.categories() is Signal<string[]>
);
```

### Factory Form

`withState` also accepts a factory function. Use this when state initialization requires computation or should be deferred:

```typescript
withState(() => ({
  timestamp: Date.now(),
  items: getDefaultItems(),
}))
```

*Verified from installed package type definitions: `withState` has two overloads accepting `State` or `() => State`.*

### Deep Signals

When a state property is an object literal, its sub-properties also become signals:

```typescript
withState({
  pagination: { page: 1, pageSize: 20 }
})
// store.pagination() returns { page: 1, pageSize: 20 }
// store.pagination.page() returns 1
// store.pagination.pageSize() returns 20
```

This is the `DeepSignal` type. Arrays, Dates, Promises, and other non-plain objects are NOT decomposed into sub-signals.

---

## 4.3 patchState and updateState

### patchState

`patchState` is the core function for updating store state. It accepts the store (a `WritableStateSource`) and one or more partial state objects or updater functions.

```typescript
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';

export const CounterStore = signalStore(
  withState({ count1: 0, count2: 0 }),
  withMethods((store) => ({
    incrementFirst(): void {
      patchState(store, (state) => ({ count1: state.count1 + 1 }));
    },
    resetSecond(): void {
      patchState(store, { count2: 0 });
    },
    resetBoth(): void {
      // Multiple updaters in one call
      patchState(store, { count1: 0 }, { count2: 0 });
    },
  }))
);
```

*Verified from installed package type definitions: `patchState(stateSource, ...updaters)` where updaters are `Partial<State> | PartialStateUpdater<State>`.*

### updateState (from ngrx-toolkit)

This workspace uses `updateState` instead of `patchState` everywhere. `updateState` wraps `patchState` and adds an action name that appears in Redux DevTools:

```typescript
import { updateState, setLoading, setLoaded } from '@angular-architects/ngrx-toolkit';

// Instead of:
patchState(store, { accessToken: token });

// This workspace uses:
updateState(store, 'login success', { accessToken: token, ...setLoaded() });
//                  ^^^^^^^^^^^^^^
//                  This label appears in Redux DevTools
```

The DevTools integration is the reason this workspace standardized on `updateState`. Every state change has a named action, making it easy to trace what happened and when.

**When to use which:**

| Function | DevTools Label | Use When |
|----------|---------------|----------|
| `patchState` | No | Prototyping, tests, stores without DevTools |
| `updateState` | Yes | Production stores with `withDevtools` |

*Verified from installed package type definitions: `updateState` is exported from `@angular-architects/ngrx-toolkit`.*

---

## 4.4 withComputed(factory)

Adds derived state as Angular `computed()` signals. The factory receives all state signals, props, and methods from previous features.

```typescript
import { computed } from '@angular/core';
import { signalStore, withState, withComputed } from '@ngrx/signals';

export const ProductsStore = signalStore(
  withState({ selectedId: null as number | null }),
  withEntities<Product>(),
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
  }))
);
```

Computed signals are read-only and re-evaluate only when their dependencies change. Angular's signal system handles memoization automatically. If `selectedId()` has not changed, `selectedProduct()` returns the cached value without re-running the `find`.

**Factory parameter:** The factory receives `StateSignals<State> & Props & Methods`. Note that it does NOT receive `WritableStateSource`, so you cannot call `patchState` inside `withComputed`. Computed signals are pure derivations.

*Verified from installed package type definitions: `withComputed` factory receives `StateSignals<Input['state']> & Input['props'] & Input['methods']`.*

---

## 4.5 withMethods(factory)

Defines the store's public API. The factory receives state signals, props, methods from previous features, AND the `WritableStateSource` (so it can call `patchState`/`updateState`).

```typescript
import { inject } from '@angular/core';
import { signalStore, withMethods, withState } from '@ngrx/signals';
import { updateState, setLoading, setLoaded, setError } from '@angular-architects/ngrx-toolkit';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap } from 'rxjs';

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialAuthState),
  withCallState(),
  withMethods((store) => {
    // inject() works here because withMethods runs in an injection context
    const authService = inject(AuthService);

    return {
      // Synchronous method
      logout(): void {
        updateState(store, 'logout', initialAuthState);
      },

      // Async method using rxMethod
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
    };
  })
);
```

### Injection Context

The `withMethods` factory body is an **injection context**. You can call `inject()` at the top level of the factory. This is how stores obtain their dependencies (HTTP services, other stores, Router, etc.) without constructor injection.

```typescript
withMethods((store) => {
  // These inject() calls work because this is an injection context
  const http = inject(HttpClient);
  const router = inject(Router);
  const authStore = inject(AuthStore);

  return {
    // Methods can use the injected services
    navigate(path: string): void {
      router.navigate([path]);
    },
  };
})
```

*Verified from installed package type definitions: `withMethods` factory receives `StateSignals<Input['state']> & Input['props'] & Input['methods'] & WritableStateSource<Input['state']>`.*

---

## 4.6 rxMethod\<T\>(operator)

`rxMethod` bridges RxJS into Signal Store. It creates a callable method that accepts a static value, a signal (or computation function), or an Observable.

```typescript
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap } from 'rxjs';

// Inside withMethods:
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
```

### Three Ways to Call rxMethod

```typescript
// 1. Static value
store.loadProducts();                    // Emits void once
store.searchProducts('laptop');          // Emits 'laptop' once

// 2. Signal (reactive - re-runs when signal changes)
store.loadUser(authStore.userId);        // Re-runs whenever userId changes

// 3. Observable
store.searchProducts(searchInput$);      // Pipes from the observable
```

When called with a signal, `rxMethod` sets up an `effect()` internally that tracks the signal. When the signal changes, the new value is pushed through the RxJS pipeline. This is how the `UserStore` auto-loads when `AuthStore.userId` changes:

```typescript
// In UserStore's withHooks:
effect(() => {
  const userId = authStore.userId();
  if (userId) {
    store.loadUser(userId);   // Called with a static value each time
  } else {
    store.clear();
  }
});
```

### Choosing the Right Flattening Operator

| Operator | Behavior | Use When |
|----------|----------|----------|
| `switchMap` | Cancels previous, starts new | Search, navigation, most data fetching |
| `exhaustMap` | Ignores new while previous is active | Token refresh, form submission (prevent double-submit) |
| `concatMap` | Queues, processes in order | Sequential operations where order matters |
| `mergeMap` | Runs all in parallel | Independent parallel operations (rare for state) |

### Error Handling

Errors inside the `switchMap` inner observable do NOT terminate the outer stream. The `tap({ error })` handler captures the error, and the next emission starts a fresh inner subscription. This is different from a typical RxJS pipe where an error would complete the stream.

*Verified from installed package type definitions: `rxMethod<Input>(generator: (source$: Observable<Input>) => Observable<unknown>): RxMethod<Input>`. `RxMethod<Input>` accepts `Input | (() => Input) | Observable<Input>`.*

---

## 4.7 signalMethod\<T\>(processor)

`signalMethod` is the signal-only alternative to `rxMethod`. It does not use RxJS. It accepts a processing function that runs synchronously when called.

```typescript
import { signalMethod } from '@ngrx/signals';

// Inside a component or service
readonly logDoubledNumber = signalMethod<number>(
  (num) => console.log(num * 2)
);

// Usage:
this.logDoubledNumber(10);            // Logs: 20
this.logDoubledNumber(this.count);    // Logs immediately, then on every count change
```

### When to Use Instead of rxMethod

| Scenario | Use |
|----------|-----|
| Side effect needs RxJS operators (debounce, switchMap, retry) | `rxMethod` |
| Side effect is synchronous or uses Promises | `signalMethod` |
| Need to react to signal changes without RxJS | `signalMethod` |
| Method is only called with static values (no signal tracking) | Regular method in `withMethods` |

`signalMethod` returns a `SignalMethod<Input>` which is both callable and an `EffectRef` (it can be destroyed).

*Verified from installed package type definitions: `signalMethod<Input>(processingFn: (value: Input) => void): SignalMethod<Input>`. It accepts `Input | (() => Input)` and returns `EffectRef`.*

---

## 4.8 withHooks({ onInit, onDestroy })

Adds lifecycle hooks to the store. The hooks run in an injection context, so `inject()` works.

```typescript
import { effect, inject } from '@angular/core';
import { signalStore, withHooks, withMethods, withState } from '@ngrx/signals';

export const UserStore = signalStore(
  { providedIn: 'root' },
  withState(initialUserState),
  withMethods((store) => {
    const userService = inject(UserService);
    return {
      loadUser: rxMethod<number>(/* ... */),
      clear(): void { /* ... */ },
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
    onDestroy(store) {
      console.log('UserStore destroyed');
    },
  })
);
```

### Two Overload Forms

```typescript
// Form 1: Object with hook functions (store is passed as argument)
withHooks({
  onInit(store) { /* ... */ },
  onDestroy(store) { /* ... */ },
})

// Form 2: Factory function (store is passed, returns hooks object)
withHooks((store) => ({
  onInit() { /* ... uses store from closure ... */ },
  onDestroy() { /* ... */ },
}))
```

Both forms are equivalent. Form 1 is more common in this workspace.

### onInit Timing

`onInit` runs when the store is first created by Angular's injector. For `providedIn: 'root'` stores, this is when the first component or service injects it. For route-provided stores, this is when the route is activated.

### onDestroy Timing

`onDestroy` runs when the store's injector is destroyed. For route-provided stores, this happens when the user navigates away. For `providedIn: 'root'` stores, `onDestroy` effectively never runs (the root injector lives as long as the app).

*Verified from installed package type definitions: `withHooks` has two overloads. The hook functions receive the full store including `WritableStateSource`.*

---

## 4.9 withProps(factory)

Adds arbitrary properties to the store. Unlike `withComputed`, these are not limited to signals. Use this for injected services, observables, or any non-signal property.

```typescript
import { toObservable } from '@angular/core/rxjs-interop';
import { signalStore, withProps, withState } from '@ngrx/signals';

export const TodosStore = signalStore(
  withState({ todos: [] as Todo[], isLoading: false }),
  withProps(({ isLoading }) => ({
    isLoading$: toObservable(isLoading),
  }))
);
```

### Common Use Cases

```typescript
withProps((store) => {
  // Expose an observable for legacy code that needs it
  const todos$ = toObservable(store.todos);

  // Inject a service and expose it
  const dialog = inject(MatDialog);

  return { todos$, dialog };
})
```

**withProps vs withComputed:** `withComputed` creates Angular `computed()` signals. `withProps` creates arbitrary properties. If your derived value is a signal, use `withComputed`. If it is an Observable, a service reference, or any other non-signal value, use `withProps`.

*Verified from installed package type definitions: `withProps` factory receives the full store including `WritableStateSource`.*

---

## 4.10 withLinkedState(factory)

Adds state slices that are reactively linked to other state in the store. This is a newer API (introduced in NgRx v20) that integrates with Angular's `linkedSignal`.

### Computation Function Form

The simplest form uses a computation function. The returned value becomes the initial (and reactive) value of the state slice:

```typescript
import { signalStore, withLinkedState, withState } from '@ngrx/signals';

export const OptionsStore = signalStore(
  withState({ options: [1, 2, 3] }),
  withLinkedState(({ options }) => ({
    selectedOption: () => options()[0],  // Re-computes when options change
  }))
);
```

When `options` changes, `selectedOption` is automatically recomputed to be the first element of the new array.

### linkedSignal Form

For advanced cases where you need to preserve user selections while reacting to source changes, use Angular's `linkedSignal`:

```typescript
import { linkedSignal } from '@angular/core';
import { signalStore, withLinkedState, withState } from '@ngrx/signals';

type Option = { id: number; label: string };

export const OptionsStore = signalStore(
  withState({ options: [] as Option[] }),
  withLinkedState(({ options }) => ({
    selectedOption: linkedSignal<Option[], Option>({
      source: options,
      computation: (newOptions, previous) => {
        // Try to preserve previous selection
        const option = newOptions.find((o) => o.id === previous?.value.id);
        return option ?? newOptions[0];
      },
    }),
  }))
);
```

### Key Difference from withComputed

`withLinkedState` creates **writable** state that can also be updated via `patchState`/`updateState`. `withComputed` creates read-only derived values. Use `withLinkedState` when the derived value should have a default computed from other state but can also be manually overridden by the user.

*Verified from installed package type definitions: `withLinkedState` factory receives `StateSignals<State> & Props` and returns a record of `WritableSignal` or `() => unknown`. The result becomes part of the store's state (not props).*

Sources: [withLinkedState API reference](https://ngrx.io/api/signals/withLinkedState), [NgRx v20 release notes](https://dev.to/ngrx/announcing-ngrx-v20-the-power-of-events-enhanced-dx-and-a-mature-signalstore-2fdm)

---

## 4.11 withFeature(featureFactory)

Passes the current store instance to a custom feature factory. This bridges the gap between store-specific context and reusable features.

```typescript
import { signalStore, withFeature, withMethods } from '@ngrx/signals';

export const UserStore = signalStore(
  withMethods((store) => ({
    loadById(id: number): Promise<User> {
      return Promise.resolve({ id, name: 'John' });
    },
  })),
  withFeature(
    // Has full access to store members defined before it
    (store) => withEntityLoader((id) => store.loadById(id))
  )
);
```

### withFeature vs signalStoreFeature

| API | Purpose | Access to Store |
|-----|---------|----------------|
| `withFeature(factory)` | Pass store context to a reusable feature | Yes, receives the current store |
| `signalStoreFeature(...)` | Compose multiple features into a reusable bundle | No, operates on abstract inputs |

Use `withFeature` when a reusable feature needs to call methods or read signals that are specific to the current store. Use `signalStoreFeature` when building a self-contained feature that works with any store matching its type constraints.

*Verified from installed package type definitions: `withFeature` factory receives `StateSignals & Props & Methods & WritableStateSource` and must return a `SignalStoreFeature`.*

Sources: [Announcing NgRx v20](https://dev.to/ngrx/announcing-ngrx-v20-the-power-of-events-enhanced-dx-and-a-mature-signalstore-2fdm)

---

## 4.12 deepComputed(computation)

Creates a computed signal where nested object properties are also individually trackable signals.

```typescript
import { signal } from '@angular/core';
import { deepComputed } from '@ngrx/signals';

const limit = signal(10);
const offset = signal(0);

const pagination = deepComputed(() => ({
  currentPage: Math.floor(offset() / limit()) + 1,
  pageSize: limit(),
}));

console.log(pagination());              // { currentPage: 1, pageSize: 10 }
console.log(pagination.currentPage());  // 1  (individual signal)
console.log(pagination.pageSize());     // 10 (individual signal)
```

### Use Cases

`deepComputed` is useful when a template needs to bind to individual properties of a derived object. Without `deepComputed`, a component binding to `pagination().currentPage` would re-render when `pageSize` changes (because the parent object reference changed). With `deepComputed`, binding to `pagination.currentPage()` only re-renders when the current page actually changes.

This is a standalone function, not a store feature. It works anywhere, including inside `withComputed`:

```typescript
withComputed((store) => ({
  pagination: deepComputed(() => ({
    currentPage: Math.floor(store.offset() / store.limit()) + 1,
    pageSize: store.limit(),
    totalPages: Math.ceil(store.total() / store.limit()),
  })),
}))
```

*Verified from installed package type definitions: `deepComputed<T extends object>(computation: () => T): DeepSignal<T>`.*

---

## 4.13 getState and watchState

### getState

Returns a snapshot of the current state from a store or `signalState`. When used inside a reactive context (like `effect()` or `computed()`), it tracks changes.

```typescript
import { effect, inject } from '@angular/core';
import { getState } from '@ngrx/signals';

@Component({ /* ... */ })
export class DebugComponent {
  readonly store = inject(CounterStore);

  constructor() {
    effect(() => {
      const state = getState(this.store);
      console.log(state); // Logs on every state change
    });
  }
}
```

`getState` returns a plain object snapshot, not signals. It is useful for logging, debugging, or passing state to non-reactive code.

*Verified from installed package type definitions: `getState<State>(stateSource: StateSource<State>): State`.*

### watchState

Synchronously tracks every state change without debouncing. Unlike `effect()`, which batches notifications via microtask, `watchState` fires immediately on each `patchState`/`updateState` call.

```typescript
import { signalState, watchState } from '@ngrx/signals';

const state = signalState({ count1: 0, count2: 0 });

const { destroy } = watchState(state, (currentState) => {
  console.log('State changed:', currentState);
});

// Call destroy() to stop watching
```

### watchState vs effect()

| Aspect | `watchState` | `effect()` |
|--------|-------------|------------|
| Timing | Synchronous, fires immediately per change | Batched, fires once per microtask |
| Multiple updates | Fires once per `patchState` call | Coalesces multiple changes |
| Use case | Logging, auditing, synchronous side effects | Reactive side effects, data loading |

In most production code, `effect()` is the right choice. `watchState` is primarily useful for debugging or audit logging where you need to observe every intermediate state.

*Verified from installed package type definitions: `watchState(stateSource, watcher, config?)` returns `{ destroy(): void }`.*

---

## 4.14 signalState()

Creates a standalone reactive state container. Unlike `signalStore`, it is NOT an Angular service and does NOT support `withComputed`, `withMethods`, or `withHooks`.

```typescript
import { signalState, patchState } from '@ngrx/signals';

// Inside a component or service
readonly state = signalState({ count: 0 });

// Read:
this.state.count();  // 0

// Update:
patchState(this.state, { count: 1 });
patchState(this.state, (s) => ({ count: s.count + 1 }));
```

`signalState` returns a `DeepSignal<State> & WritableStateSource<State>`. This means:
- It is a signal itself: `this.state()` returns the full state object.
- Each property is a signal: `this.state.count()` returns the count.
- It works with `patchState`: `patchState(this.state, { count: 1 })`.

**When to use:** Component-local structured state that does not need the full store API. See Chapter 1's spectrum table.

*Verified from installed package type definitions: `signalState<State>(initialState: State): SignalState<State>` where `SignalState<State> = DeepSignal<State> & WritableStateSource<State>`.*

---

## 4.15 signalStoreFeature()

Composes multiple features into a single reusable feature. This is the primary mechanism for creating custom, reusable store extensions.

### Without Type Constraints

```typescript
import { signalStoreFeature, withState, withComputed, withMethods } from '@ngrx/signals';
import { withCallState, setLoading, setLoaded, setError, withDevtools } from '@angular-architects/ngrx-toolkit';

// A reusable feature that adds loading state with standard patterns
export function withLoadingState(name: string) {
  return signalStoreFeature(
    withDevtools(name),
    withCallState(),
  );
}
```

### With Type Constraints (Input Requirements)

When a custom feature requires certain state or methods to exist on the store, use the `input` parameter:

```typescript
import { signalStoreFeature, withMethods } from '@ngrx/signals';
import type { SignalStoreFeature, EmptyFeatureResult, SignalStoreFeatureResult } from '@ngrx/signals';

// This feature requires the store to have a `selectedId` state property
export function withSelectedEntity<Entity extends { id: number }>() {
  return signalStoreFeature(
    { state: {} as { selectedId: number | null }, props: {} as { entities: Signal<Entity[]> } },
    withComputed((store) => ({
      selectedEntity: computed(() => {
        const id = store.selectedId();
        return id ? store.entities().find((e) => e.id === id) ?? null : null;
      }),
    }))
  );
}
```

The `input` object acts as a type constraint. The feature can only be used in stores that have `selectedId` in their state and `entities` in their props. TypeScript enforces this at compile time.

*Verified from installed package type definitions: `signalStoreFeature` supports up to 15 features with an optional `Input` constraint parameter.*

---

## 4.16 Entity Management (withEntities)

The `@ngrx/signals/entities` entry point provides a complete entity collection management system.

### Adding Entity Support

```typescript
import { signalStore, withState } from '@ngrx/signals';
import { withEntities } from '@ngrx/signals/entities';

export const ProductsStore = signalStore(
  withState({ selectedId: null as number | null }),
  withEntities<Product>(),
  // Adds to state: entityMap (Record<EntityId, Product>), ids (EntityId[])
  // Adds to props: entities (Signal<Product[]>)
);
```

### Entity State Shape

`withEntities<Entity>()` adds:

| Added To | Name | Type | Description |
|----------|------|------|-------------|
| State | `entityMap` | `Record<EntityId, Entity>` | Dictionary for O(1) lookup by ID |
| State | `ids` | `EntityId[]` | Ordered array of entity IDs |
| Props | `entities` | `Signal<Entity[]>` | Computed array of entities in order |

### Entity Updater Functions

All entity updaters are used as arguments to `patchState` or `updateState`:

```typescript
import {
  setAllEntities, setEntities, setEntity,
  addEntity, addEntities,
  updateEntity, updateEntities, updateAllEntities,
  removeEntity, removeEntities, removeAllEntities,
  upsertEntity, upsertEntities,
  prependEntity, prependEntities,
} from '@ngrx/signals/entities';

// Replace all entities
updateState(store, 'load success', setAllEntities(products));

// Add one entity
updateState(store, 'add product', addEntity(newProduct));

// Update by ID
updateState(store, 'update price',
  updateEntity({ id: 42, changes: { price: 29.99 } })
);

// Update by predicate
updateState(store, 'discount all',
  updateEntities({
    predicate: (p) => p.category === 'electronics',
    changes: (p) => ({ price: p.price * 0.9 }),
  })
);

// Remove by ID
updateState(store, 'remove product', removeEntity(42));

// Remove by predicate
updateState(store, 'remove discontinued',
  removeEntities((p) => p.discontinued)
);

// Upsert (insert or update)
updateState(store, 'upsert product', upsertEntity(product));

// Prepend (add to beginning)
updateState(store, 'prepend product', prependEntity(product));
```

### Custom Entity ID

By default, `withEntities` expects entities to have an `id` property of type `string | number`. For entities with a different ID field, use `entityConfig`:

```typescript
import { entityConfig, withEntities } from '@ngrx/signals/entities';

const orderConfig = entityConfig({
  entity: {} as Order,
  selectId: (order) => order.orderId,
});

export const OrdersStore = signalStore(
  withEntities(orderConfig),
  // ...
);
```

### Named Entity Collections

To manage multiple entity types in one store, use named collections:

```typescript
withEntities({ entity: {} as Product, collection: 'products' }),
withEntities({ entity: {} as Category, collection: 'categories' }),
// Adds: productsEntityMap, productsIds, productsEntities
// Adds: categoriesEntityMap, categoriesIds, categoriesEntities
```

Named collections prefix all state and prop names with the collection name. Entity updaters also accept a `{ collection: 'name' }` config:

```typescript
setAllEntities(products, { collection: 'products' })
addEntity(category, { collection: 'categories' })
```

*Verified from installed package type definitions: All entity functions exported from `@ngrx/signals/entities`. `EntityId = string | number`. `EntityState<Entity> = { entityMap: EntityMap<Entity>; ids: EntityId[] }`.*

---

## 4.17 Cross-Store Reactivity

When one store needs to react to changes in another, there are two patterns in this workspace.

### Pattern 1: Direct Injection + effect() in withHooks

This is the pattern used by `UserStore` to react to `AuthStore`:

```typescript
// libs/state/core/src/lib/user/user.store.ts
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

**Why this works:** `inject(AuthStore)` in `onInit` gets the same singleton instance (because both stores are `providedIn: 'root'` and shared via webpack singletons). The `effect()` tracks `authStore.userId()`. When it changes (login/logout), the effect body runs, triggering `loadUser` or `clear`.

**When to use:** Within the same deployment unit (same remote or shell). Stores in `libs/state/core` can safely inject each other because they are always loaded together.

### Pattern 2: Events for Cross-Remote Decoupling

When stores in different remotes need to communicate, use events (covered in detail in Chapter 9). The key difference: direct injection creates a compile-time dependency. Events do not.

| Aspect | Direct Injection | Events |
|--------|-----------------|--------|
| Compile-time coupling | Yes | No |
| Type safety | Full (inject gives typed instance) | Partial (event payload typed, handler untyped) |
| Traceability | Follow `inject()` calls | Search for `withEventHandlers` |
| Use when | Same lib or same deployment unit | Cross-remote or decoupled domains |

---

## 4.18 Complete API Reference

All exports from `@ngrx/signals` v21.1.0 and its entry points:

### @ngrx/signals

| Export | Category | Description |
|--------|----------|-------------|
| `signalStore` | Factory | Creates an injectable Angular service class |
| `signalState` | Factory | Creates a standalone reactive state container |
| `signalStoreFeature` | Composition | Composes features into a reusable bundle |
| `withState` | Feature | Adds managed state |
| `withComputed` | Feature | Adds derived state signals |
| `withMethods` | Feature | Adds the store's public API |
| `withHooks` | Feature | Adds lifecycle hooks (onInit, onDestroy) |
| `withProps` | Feature | Adds arbitrary properties |
| `withLinkedState` | Feature | Adds reactive linked state slices |
| `withFeature` | Feature | Passes store to a custom feature factory |
| `patchState` | Utility | Updates state with partial objects or updaters |
| `getState` | Utility | Returns a snapshot of current state |
| `watchState` | Utility | Synchronously tracks every state change |
| `deepComputed` | Utility | Creates a computed signal with nested signal properties |
| `signalMethod` | Utility | Creates a signal-based reactive method |
| `isWritableStateSource` | Guard | Type guard for writable state sources |
| `type` | Helper | Type helper for event payloads |

### @ngrx/signals/entities

| Export | Category | Description |
|--------|----------|-------------|
| `withEntities` | Feature | Adds entity collection state |
| `entityConfig` | Helper | Creates entity configuration with custom ID |
| `setAllEntities` | Updater | Replace all entities |
| `setEntities` | Updater | Set specific entities |
| `setEntity` | Updater | Set a single entity |
| `addEntity` / `addEntities` | Updater | Append entities |
| `prependEntity` / `prependEntities` | Updater | Prepend entities |
| `updateEntity` / `updateEntities` / `updateAllEntities` | Updater | Update entities by ID or predicate |
| `removeEntity` / `removeEntities` / `removeAllEntities` | Updater | Remove entities by ID or predicate |
| `upsertEntity` / `upsertEntities` | Updater | Insert or update entities |

### @ngrx/signals/rxjs-interop

| Export | Category | Description |
|--------|----------|-------------|
| `rxMethod` | Utility | Creates an RxJS-based reactive method |

### @ngrx/signals/testing

| Export | Category | Description |
|--------|----------|-------------|
| `unprotected` | Utility | Removes state protection for testing (see Chapter 7) |

*All exports verified from installed package type definitions in `node_modules/@ngrx/signals/types/`.*

---

## Summary

- **`signalStore()`** generates an Angular service. Feature composition order matters: left-to-right.
- **`withState`** defines the state shape. Each property becomes a deep signal.
- **`updateState`** (from ngrx-toolkit) wraps `patchState` with DevTools action labels. This workspace uses it everywhere.
- **`withComputed`** creates derived signals. Pure derivations only, no side effects.
- **`withMethods`** defines the public API. Runs in an injection context (`inject()` works).
- **`rxMethod`** bridges RxJS for async side effects. Accepts static values, signals, or observables.
- **`signalMethod`** is the signal-only alternative for synchronous side effects.
- **`withHooks`** provides `onInit`/`onDestroy` lifecycle. Use `onInit` for cross-store reactivity via `effect()`.
- **`withLinkedState`** creates writable state derived from other state. Integrates with Angular's `linkedSignal`.
- **`withFeature`** passes the current store to a custom feature. Bridges store context and reusable features.
- **`withEntities`** provides a complete entity collection system with 15+ updater functions.
- **Cross-store reactivity** uses direct injection + `effect()` in `withHooks` for same-unit stores.

Next: [Chapter 5: ngrx-toolkit in Production](./05-ngrx-toolkit-in-production.md) covers the toolkit features layered on top of these core APIs.
