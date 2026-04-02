# Chapter 5: ngrx-toolkit in Production

> `@angular-architects/ngrx-toolkit` adds the features that `@ngrx/signals` intentionally leaves out: DevTools integration, call state tracking, reset, undo/redo, storage sync, and more. This chapter covers what to adopt now, what to evaluate, and what to skip.

All APIs in this chapter are from `@angular-architects/ngrx-toolkit` v21.0.1. Every function name and signature is verified against the installed type definitions.

---

## 5.1 withDevtools(name, ...features)

Connects a Signal Store to the Redux DevTools browser extension. Every store in this workspace uses it.

```typescript
import { signalStore, withState } from '@ngrx/signals';
import { withDevtools } from '@angular-architects/ngrx-toolkit';

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withDevtools('auth'),
  withState(initialAuthState),
  // ...
);
```

The string `'auth'` is the name that appears in DevTools. Each store gets its own named entry. State changes show up as actions, and you can time-travel through the history.

### Positioning in Feature Order

`withDevtools` should be placed **before** `withState`. It needs to observe all state additions and changes. Placing it after `withState` would miss the initial state registration.

### provideDevtoolsConfig

The shell's `app.config.ts` calls `provideDevtoolsConfig` to set a global name for the DevTools instance:

```typescript
// apps/shell/src/app/app.config.ts
import { provideDevtoolsConfig } from '@angular-architects/ngrx-toolkit';

export const appConfig: ApplicationConfig = {
  providers: [
    // ...
    provideDevtoolsConfig({ name: 'State Management' }),
  ],
};
```

This sets the DevTools instance name. Only call it once, in the shell. Remotes inherit it through the shared singleton (see Chapter 3).

*Verified from installed package type definitions: `provideDevtoolsConfig(config: ReduxDevtoolsConfig): ValueProvider` where `ReduxDevtoolsConfig = { name?: string }`.*

### DevTools Feature Functions

`withDevtools` accepts optional feature functions that modify its behavior:

#### withGlitchTracking()

By default, Angular's signal system coalesces multiple synchronous state changes into one notification (the "glitch-free" mechanism). DevTools only sees the final state. `withGlitchTracking()` overrides this, recording every intermediate change.

```typescript
import { withDevtools, withGlitchTracking } from '@angular-architects/ngrx-toolkit';

export const CounterStore = signalStore(
  { providedIn: 'root' },
  withDevtools('counter', withGlitchTracking()),
  withState({ count: 0 }),
  withMethods((store) => ({
    increase: () => updateState(store, 'increase', (s) => ({ count: s.count + 1 })),
  }))
);

// Without withGlitchTracking: calling increase() 3 times shows only final value (3)
// With withGlitchTracking: shows 1, 2, 3 as separate actions
```

**When to use:** Debugging intermediate state changes. Adds overhead, so consider enabling only during development.

*Verified from installed package type definitions: `withGlitchTracking(): DevtoolsFeature`.*

#### withMapper(mapFn)

Transforms the state before it is sent to DevTools. Use this to hide sensitive data or reduce large state objects.

```typescript
import { withDevtools, withMapper } from '@angular-architects/ngrx-toolkit';

export const UserStore = signalStore(
  withDevtools(
    'user',
    withMapper((state) => ({
      ...state,
      accessToken: state.accessToken ? '***' : null,
      refreshToken: state.refreshToken ? '***' : null,
    }))
  ),
  withState(initialUserState),
  // ...
);
```

**When to use:** When state contains tokens, passwords, or PII that should not be visible in DevTools. Also useful for stores with large entity collections where DevTools becomes slow.

*Verified from installed package type definitions: `withMapper<State extends object>(map: (state: State) => Record<string, unknown>): DevtoolsFeature`.*

#### withDisabledNameIndices()

When multiple instances of the same store class exist, DevTools appends a numeric index to the name (e.g., `flights`, `flights-1`). `withDisabledNameIndices()` disables this and throws an error if a duplicate is detected.

```typescript
import { withDevtools, withDisabledNameIndices } from '@angular-architects/ngrx-toolkit';

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withDevtools('auth', withDisabledNameIndices()),
  // If a second AuthStore instance is created, it throws an error
);
```

**When to use:** For `providedIn: 'root'` singletons where a duplicate instance indicates a bug (broken MF singleton sharing).

*Verified from installed package type definitions: `withDisabledNameIndices(): DevtoolsFeature`.*

### updateState for DevTools Action Names

As covered in Chapter 4, `updateState` wraps `patchState` and sends a named action to DevTools:

```typescript
import { updateState, setLoading, setLoaded } from '@angular-architects/ngrx-toolkit';

// This appears in DevTools as action "login"
updateState(store, 'login', setLoading());

// This appears as "login success"
updateState(store, 'login success', {
  accessToken: response.accessToken,
  ...setLoaded(),
});
```

Without `updateState`, every state change shows as the generic "Store Update" action, making DevTools much less useful.

*Verified from installed package type definitions: `updateState<State>(stateSource, action: string, ...updaters): void`.*

### renameDevtoolsName

Renames a store in DevTools at runtime. Useful for component-level stores where the name should include context:

```typescript
import { renameDevtoolsName } from '@angular-architects/ngrx-toolkit';

// After creating a component-level store instance
renameDevtoolsName(store, `product-editor-${productId}`);
```

*Verified from installed package type definitions: `renameDevtoolsName<State>(store: StateSource<State>, newName: string): void`.*

### withDevToolsStub

A stub implementation that has the same API as `withDevtools` but does nothing. Use it to conditionally disable DevTools in production builds:

```typescript
import { withDevtools, withDevToolsStub } from '@angular-architects/ngrx-toolkit';
import { environment } from '../environments/environment';

const devtools = environment.production ? withDevToolsStub : withDevtools;

export const AuthStore = signalStore(
  { providedIn: 'root' },
  devtools('auth'),
  // ...
);
```

*Verified from installed package type definitions: `withDevToolsStub` has the same type as `withDevtools`.*

### DevTools Feature Summary

| Feature | Purpose | Production Use |
|---------|---------|---------------|
| `withDevtools(name)` | Connect store to Redux DevTools | Yes (or use `withDevToolsStub`) |
| `withGlitchTracking()` | Record intermediate state changes | Dev only |
| `withMapper(fn)` | Hide sensitive data or reduce state size | Yes |
| `withDisabledNameIndices()` | Error on duplicate instances | Yes, for singletons |
| `renameDevtoolsName(store, name)` | Rename at runtime | Yes, for component-level stores |
| `withDevToolsStub` | No-op replacement | Production builds |

Sources: [withDevtools() docs](https://ngrx-toolkit.angulararchitects.io/docs/with-devtools), [Function: withDevtools() API](https://ngrx-toolkit.angulararchitects.io/docs/api/functions/withDevtools)

---

## 5.2 withCallState()

Adds loading/error tracking to a store. This is the most-used toolkit feature in this workspace. Every store that makes HTTP calls uses it.

### CallState Type

```typescript
type CallState = 'init' | 'loading' | 'loaded' | { error: string };
```

The four states form a simple state machine:

```
init ──► loading ──► loaded
                └──► { error: 'message' }
```

### Unnamed Usage

```typescript
import { signalStore, withState } from '@ngrx/signals';
import { withCallState, setLoading, setLoaded, setError } from '@angular-architects/ngrx-toolkit';

export const AuthStore = signalStore(
  withState(initialAuthState),
  withCallState(),
  // Adds to state: callState (CallState)
  // Adds to props: loading (Signal<boolean>), loaded (Signal<boolean>), error (Signal<string | null>)
);
```

The three derived signals (`loading`, `loaded`, `error`) are computed from `callState`:

| Signal | True When |
|--------|-----------|
| `store.loading()` | `callState === 'loading'` |
| `store.loaded()` | `callState === 'loaded'` |
| `store.error()` | `callState` is `{ error: string }`, returns the error string; `null` otherwise |

### State Transition Helpers

```typescript
import { setLoading, setLoaded, setError, updateState } from '@angular-architects/ngrx-toolkit';

// Set loading
updateState(store, 'load products', setLoading());

// Set loaded
updateState(store, 'load products success', setLoaded());

// Set error
updateState(store, 'load products error', setError('Network timeout'));

// Combine with other state updates
updateState(store, 'load products success', {
  total: response.total,
  ...setLoaded(),
});
```

`setLoading()`, `setLoaded()`, and `setError()` return partial state objects: `{ callState: 'loading' }`, `{ callState: 'loaded' }`, and `{ callState: { error: 'message' } }`. Using the spread operator (`...setLoaded()`) merges them into the update.

### Named Collection Usage

When a store has multiple independent async operations, use named collections:

```typescript
export const DashboardStore = signalStore(
  withCallState({ collection: 'orders' }),
  withCallState({ collection: 'products' }),
  // Adds: ordersCallState, ordersLoading, ordersLoaded, ordersError
  // Adds: productsCallState, productsLoading, productsLoaded, productsError
);
```

The setter helpers also accept collection names:

```typescript
updateState(store, 'load orders', setLoading('orders'));
updateState(store, 'load orders success', setLoaded('orders'));
updateState(store, 'load orders error', setError('Failed', 'orders'));
```

### Multiple Collections Shorthand

```typescript
withCallState({ collections: ['orders', 'products'] })
// Equivalent to calling withCallState twice with each collection name
```

### Template Integration

```typescript
@Component({
  template: `
    @if (store.loading()) {
      <app-loading-spinner />
    } @else if (store.error(); as error) {
      <app-error-message [message]="error" />
    } @else if (store.loaded()) {
      <app-product-list [products]="store.entities()" />
    }
  `,
})
export class ProductsListComponent {
  readonly store = inject(ProductsStore);
}
```

*Verified from installed package type definitions: `withCallState()` has three overloads (unnamed, named collection, multiple collections). `CallState = 'init' | 'loading' | 'loaded' | { error: string }`. `setLoading`, `setLoaded`, `setError` accept optional collection name.*

Sources: [withCallState() docs](https://ngrx-toolkit.angulararchitects.io/docs/with-call-state)

---

## 5.3 withReset()

Adds a `resetState()` method that resets the store to its initial state.

```typescript
import { signalStore, withState } from '@ngrx/signals';
import { withReset } from '@angular-architects/ngrx-toolkit';

export const CartStore = signalStore(
  withState({ items: [] as CartItem[], total: 0 }),
  withCallState(),
  withReset(),
  // Adds method: resetState()
);
```

Calling `store.resetState()` reverts all state (including `callState`) to the values defined when the store was created.

### Logout Cleanup Pattern

```typescript
// In a logout handler
authStore.logout();
cartStore.resetState();   // Clears cart items
// UserStore clears itself via the effect() watching AuthStore.userId
```

### Custom Reset State

If the "initial state" should change after creation (e.g., after loading defaults from the server), use `setResetState`:

```typescript
import { setResetState } from '@angular-architects/ngrx-toolkit';

// After loading default preferences from the server
setResetState(store, { ...currentState, preferences: serverDefaults });

// Now resetState() resets to the new baseline, not the original initialState
```

### withReset vs Manual Reset

This workspace's stores currently use manual reset with `updateState`:

```typescript
// Manual reset (current pattern in AuthStore)
logout(): void {
  updateState(store, 'logout', initialAuthState);
}
```

| Aspect | `withReset()` | Manual Reset |
|--------|--------------|-------------|
| Resets ALL state (including callState, entities) | Yes | Only what you specify |
| DevTools action name | Generic "resetState" | Custom (e.g., "logout") |
| Needs reference to initial state | No | Yes |
| Selective reset | No (all or nothing) | Yes (choose which fields) |

**Recommendation:** Use `withReset()` for stores that need a full "factory reset" (like cart on logout). Use manual reset when you need selective clearing or custom DevTools labels.

*Verified from installed package type definitions: `withReset()` adds `resetState()` method. `setResetState(store, state)` updates the baseline.*

Sources: [withReset() docs](https://ngrx-toolkit.angulararchitects.io/docs/with-reset)

---

## 5.4 withUndoRedo(options)

Adds undo/redo stack tracking to a store.

```typescript
import { signalStore, withState } from '@ngrx/signals';
import { withUndoRedo } from '@angular-architects/ngrx-toolkit';

export const FormEditorStore = signalStore(
  withState({ title: '', body: '', tags: [] as string[] }),
  withUndoRedo({ maxStackSize: 50 }),
  // Adds props: canUndo (Signal<boolean>), canRedo (Signal<boolean>)
  // Adds methods: undo(), redo(), clearStack() (deprecated)
);
```

### Configuration Options

| Option | Type | Default | Purpose |
|--------|------|---------|---------|
| `maxStackSize` | `number` | 100 | Maximum undo history entries |
| `collections` | `string[]` | All | Entity collections to track (matches `withEntities` collection names) |
| `keys` | `string[]` | All | State keys to track (subset of state properties) |
| `skip` | `number` | 0 | Number of initial state changes to skip before recording |

### Template Integration

```typescript
@Component({
  template: `
    <button (click)="store.undo()" [disabled]="!store.canUndo()">Undo</button>
    <button (click)="store.redo()" [disabled]="!store.canRedo()">Redo</button>
  `,
})
export class FormEditorComponent {
  readonly store = inject(FormEditorStore);
}
```

### Clearing the Stack

The `clearStack()` method on the store is deprecated. Use the standalone `clearUndoRedo` function instead:

```typescript
import { clearUndoRedo } from '@angular-architects/ngrx-toolkit';

// Soft reset (keeps the current state as the new baseline)
clearUndoRedo(store);

// Hard reset with a specific last record
clearUndoRedo(store, { lastRecord: { title: 'Draft' } });
```

### When to Use

Undo/redo adds memory overhead (each state snapshot is stored) and complexity. Use it for:

- **Form editors** where users expect Ctrl+Z behavior
- **Visual editors** (drag-and-drop layout builders, diagram editors)
- **Multi-step wizards** where users need to go back

Do NOT use for stores with frequent high-volume updates (real-time data, chat messages) or stores with large entity collections (the entire entityMap is snapshotted on each change).

*Verified from installed package type definitions: `withUndoRedo(options?)` adds `canUndo`, `canRedo` signals and `undo()`, `redo()` methods. `clearUndoRedo(store, opts?)` is a standalone function.*

---

## 5.5 withTrackedReducer()

Combines `@ngrx/signals/events` with DevTools tracking. Event-based state changes appear as named actions in DevTools.

```typescript
import { signalStore, withState } from '@ngrx/signals';
import { on } from '@ngrx/signals/events';
import { withTrackedReducer } from '@angular-architects/ngrx-toolkit';
import { cartEvents } from './cart.events';

export const CartStore = signalStore(
  withState({ itemCount: 0 }),
  withEntities<CartProduct>(),
  withTrackedReducer(
    on(cartEvents.addToCart, (event, state) => ({
      itemCount: state.itemCount + 1,
    })),
    on(cartEvents.clearCart, () => ({
      itemCount: 0,
    }))
  ),
);
```

Each event handled by `withTrackedReducer` appears in DevTools with the event type as the action name (e.g., `[Cart] addToCart`). This replaces the need for manual `updateState` calls inside event handlers.

**When to use:** When you adopt `@ngrx/signals/events` and want event-based state changes to appear in DevTools. See Chapter 9 for the full events API.

*Verified from installed package type definitions: `withTrackedReducer<State>(...caseReducers)` accepts `on()` results and requires the store to have matching state.*

---

## 5.6 Evaluation: withDataService(config)

`withDataService` generates a full CRUD API for an entity store. It requires a `DataService` implementation.

### DataService Interface

```typescript
interface DataService<E extends { id: EntityId }, F extends Record<string, unknown>> {
  load(filter: F): Promise<E[]>;
  loadById(id: EntityId): Promise<E>;
  create(entity: E): Promise<E>;
  update(entity: E): Promise<E>;
  updateAll(entity: E[]): Promise<E[]>;
  delete(entity: E): Promise<void>;
}
```

Note: all methods return **Promises**, not Observables. If your API layer uses `HttpClient` (which returns Observables), you must wrap every call with `firstValueFrom`:

```typescript
@Injectable({ providedIn: 'root' })
export class ProductsDataService implements DataService<Product, ProductFilter> {
  private http = inject(HttpClient);

  load(filter: ProductFilter): Promise<Product[]> {
    return firstValueFrom(
      this.http.get<Product[]>('/api/products', { params: filter })
    );
  }
  // ... same wrapping for every method
}
```

### Generated Methods

For unnamed usage, `withDataService` adds:

| Method | What It Does |
|--------|-------------|
| `load()` | Calls `dataService.load(filter)`, sets entities, updates callState |
| `loadById(id)` | Calls `dataService.loadById(id)`, sets `current` |
| `create(entity)` | Calls `dataService.create(entity)`, adds entity |
| `update(entity)` | Calls `dataService.update(entity)`, updates entity |
| `updateAll(entities)` | Calls `dataService.updateAll(entities)`, updates all |
| `delete(entity)` | Calls `dataService.delete(entity)`, removes entity |
| `updateFilter(filter)` | Sets the current filter |
| `updateSelected(id, selected)` | Toggles entity selection |
| `setCurrent(entity)` | Sets the currently viewed entity |

### Prerequisites

`withDataService` requires `withCallState` and `withEntities` to be added before it:

```typescript
export const ProductsStore = signalStore(
  withEntities<Product>(),
  withCallState(),
  withDataService({
    dataServiceType: ProductsDataService,
    filter: { category: '' },
  }),
);
```

### Verdict

| Aspect | Assessment |
|--------|-----------|
| Saves boilerplate | Yes, generates 9+ methods automatically |
| Promise-based API | Friction if your services use Observables |
| Error handling | Basic (sets callState to error) |
| Customization | Limited; no control over flattening strategy, retry, or partial updates |
| RxJS operators | Not available (no `debounceTime`, `switchMap` control) |
| DevTools integration | Uses generic action names unless combined with `updateState` |

**Recommendation:** Evaluate for simple CRUD feature stores where the default behavior is sufficient. For stores that need custom loading strategies (debounced search, optimistic updates, token refresh), manual `rxMethod` gives more control. This workspace uses manual `rxMethod` patterns, which is the right choice given the need for `switchMap`, `exhaustMap`, and custom error handling.

*Verified from installed package type definitions: `withDataService` requires `withCallState` and `withEntities` in the store's feature chain. `DataService` methods return `Promise`.*

Sources: [withDataService() docs](https://ngrx-toolkit.angulararchitects.io/docs/with-data-service)

---

## 5.7 Evaluation: withStorageSync(config)

Synchronizes store state with browser storage. Reads on initialization, writes on every state change.

### Basic Usage

```typescript
import { withStorageSync } from '@angular-architects/ngrx-toolkit';

export const SettingsStore = signalStore(
  withState({ theme: 'light', language: 'en' }),
  withStorageSync('settings'),
  // On init: reads 'settings' key from localStorage and patches state
  // On every change: writes state to localStorage under 'settings' key
);
```

### Storage Backends

```typescript
import {
  withStorageSync,
  withLocalStorage,
  withSessionStorage,
  withIndexedDB,
} from '@angular-architects/ngrx-toolkit';

// localStorage (default, synchronous)
withStorageSync('key')
withStorageSync('key', withLocalStorage())

// sessionStorage (synchronous, cleared when tab closes)
withStorageSync('key', withSessionStorage())

// IndexedDB (asynchronous, large storage)
withStorageSync('key', withIndexedDB())
```

| Backend | Sync/Async | Size Limit | Persistence | Use When |
|---------|-----------|------------|-------------|----------|
| `localStorage` | Sync | ~5 MB | Permanent | Settings, preferences, small state |
| `sessionStorage` | Sync | ~5 MB | Tab session | Temp state, form drafts |
| `IndexedDB` | Async | Large (50+ MB) | Permanent | Large datasets, offline caching |

### Configuration Object

```typescript
withStorageSync({
  key: 'auth-tokens',
  autoSync: true,           // Read on init, write on change (default: true)
  select: (state) => ({     // Only persist certain fields
    accessToken: state.accessToken,
    refreshToken: state.refreshToken,
  }),
  parse: JSON.parse,        // Custom deserialization
  stringify: JSON.stringify, // Custom serialization
})
```

### Generated Methods

`withStorageSync` adds three methods (for synchronous backends):

| Method | Purpose |
|--------|---------|
| `clearStorage()` | Removes the key from storage |
| `readFromStorage()` | Manually reads from storage and patches state |
| `writeToStorage()` | Manually writes current state to storage |

When `autoSync: true` (default), reads happen automatically on store init and writes happen on every state change. Set `autoSync: false` if you want manual control.

### Security Considerations

**Do NOT store sensitive tokens in `localStorage` without additional protection.** `localStorage` is accessible to any JavaScript on the page, making it vulnerable to XSS attacks. If you use `withStorageSync` for auth tokens:

1. Only persist refresh tokens (not access tokens, which should be short-lived).
2. Consider using `sessionStorage` instead (cleared when tab closes).
3. Use the `select` option to exclude sensitive fields.
4. Use the `stringify`/`parse` options to add encryption if needed.

**Recommendation:** Evaluate for user preferences, UI settings, and non-sensitive state. Be cautious with auth tokens. The `select` option makes it possible to persist only specific fields, which mitigates the "persisting everything" problem.

*Verified from installed package type definitions: `withStorageSync` has six overloads supporting string key, config object, and three storage strategies (`withLocalStorage`, `withSessionStorage`, `withIndexedDB`).*

Sources: [withStorageSync() docs](https://ngrx-toolkit.angulararchitects.io/docs/with-storage-sync)

---

## 5.8 Evaluation: withResource() and Mutations

These are newer features connecting the toolkit with Angular's Resource API.

### withResource

Connects an Angular `Resource` to the store, allowing declarative data loading:

```typescript
import { withResource } from '@angular-architects/ngrx-toolkit';

export const ProductStore = signalStore(
  withState({ productId: null as number | null }),
  withResource({
    // Angular Resource loader
    loader: (store) => store.productId()
      ? fetch(`/api/products/${store.productId()}`).then(r => r.json())
      : undefined,
  }),
);
```

### Mutations (rxMutation, httpMutation)

Provide structured mutation operations:

```typescript
import { rxMutation, httpMutation } from '@angular-architects/ngrx-toolkit';

// rxMutation: wraps an Observable-based operation
const saveMutation = rxMutation<Product>((product) =>
  http.put(`/api/products/${product.id}`, product)
);

// httpMutation: specifically for HTTP operations with typed request/response
```

**Recommendation:** These features integrate with Angular's experimental Resource API. The API surface is still evolving. Evaluate when the Resource API stabilizes in Angular. For now, the `rxMethod` pattern used in this workspace provides equivalent functionality with more mature tooling.

*Verified from installed package type definitions: `withResource`, `rxMutation`, and `httpMutation` are exported from `@angular-architects/ngrx-toolkit`.*

---

## 5.9 Other Features

### withImmutableState(state, options?)

Replaces `withState` and applies `Object.freeze` to state properties, preventing accidental mutation:

```typescript
import { withImmutableState } from '@angular-architects/ngrx-toolkit';

export const Store = signalStore(
  withImmutableState({
    address: { street: 'Main St', city: 'Springfield' },
  }, { enableInProduction: false }),
  // Mutating address directly will throw in dev mode
);
```

**Limitation:** Only freezes object-type root properties. Primitive root properties (`id: 1`, `name: 'foo'`) cannot be frozen because they are `WritableSignal`s in NgRx v20+.

**Recommendation:** Useful during development to catch accidental mutation bugs. Consider enabling for stores with complex nested state.

*Verified from installed package type definitions: `withImmutableState` accepts `State | () => State` and optional `{ enableInProduction?: boolean }`.*

### withConditional()

Conditionally applies a feature:

```typescript
import { withConditional } from '@angular-architects/ngrx-toolkit';

export const Store = signalStore(
  withState({ count: 0 }),
  withConditional(environment.enableAudit, () => withAuditLog()),
);
```

**Recommendation:** Useful for feature-flagged store extensions. Avoid overusing it; if a feature is always needed, just include it directly.

### withFeatureFactory()

Creates features dynamically based on the current store:

```typescript
import { withFeatureFactory } from '@angular-architects/ngrx-toolkit';

export const Store = signalStore(
  withState({ items: [] }),
  withFeatureFactory((store) =>
    store.items().length > 100 ? withPagination() : emptyFeature
  ),
);
```

**Recommendation:** Advanced pattern. Only use when feature composition truly needs to be dynamic.

### withPagination()

Adds client-side pagination to an entity store:

```typescript
import { withPagination, gotoPage, nextPage, previousPage, setPageSize } from '@angular-architects/ngrx-toolkit';

export const Store = signalStore(
  withEntities<Product>(),
  withPagination<Product>(),
  // Adds: currentPage, pageSize, totalCount, pageCount, selectedPageEntities
  // Adds: hasNextPage, hasPreviousPage, pageNavigationArray
);
```

Navigation helpers work as `patchState` / `updateState` updaters:

```typescript
updateState(store, 'next page', nextPage());
updateState(store, 'go to page', gotoPage(3));
updateState(store, 'set page size', setPageSize(25));
```

**Recommendation:** Useful for stores managing large collections with client-side pagination. For server-side pagination, you will still need custom `rxMethod` logic to fetch pages from the API. The pagination signals (`currentPage`, `pageSize`, etc.) can still be useful for tracking the current pagination state.

*Verified from installed package type definitions: `withPagination<E>()` adds `PaginationServiceState` and `PaginationServiceSignals`. Navigation functions (`gotoPage`, `nextPage`, `previousPage`, `firstPage`, `setPageSize`) are updaters for `patchState`/`updateState`.*

### withRedux()

Adds a Redux-style action/reducer/effects pattern on top of Signal Store:

```typescript
import { withRedux, payload, noPayload } from '@angular-architects/ngrx-toolkit';

export const Store = signalStore(
  withState({ flights: [] }),
  withRedux({
    actions: {
      init: noPayload,
      loadSuccess: payload<{ flights: Flight[] }>(),
    },
    reducer: (actions, on) => {
      on(actions.loadSuccess, (state, { flights }) => {
        patchState(state, { flights });
      });
    },
    effects: (actions, create) => ({
      init$: create(actions.init).pipe(/* ... */),
    }),
  }),
);
```

**Recommendation: Skip.** The `createEffects` function in the toolkit is deprecated in favor of `@ngrx/signals/events` (starting in v19.2). If you need an event-driven pattern, use `@ngrx/signals/events` directly (see Chapter 9). `withRedux` adds its own action system that does not integrate with the NgRx events ecosystem.

*Verified from installed package type definitions: `createEffects` is marked `@deprecated`.*

---

## 5.10 Feature Evaluation Matrix

| Feature | Status | Day One | Complexity | Value | Recommendation |
|---------|--------|---------|------------|-------|---------------|
| `withDevtools` | Stable | Yes | Low | High | Use on every store |
| `withCallState` | Stable | Yes | Low | High | Use on every async store |
| `updateState` | Stable | Yes | Low | High | Use instead of `patchState` |
| `withReset` | Stable | Evaluate | Low | Medium | Use for full-reset scenarios |
| `withUndoRedo` | Stable | No | Medium | Medium | Use for editor UIs |
| `withTrackedReducer` | Stable | No | Medium | Medium | Use with events + DevTools |
| `withStorageSync` | Stable | Evaluate | Low | Medium | Use for preferences, be cautious with tokens |
| `withPagination` | Stable | No | Low | Medium | Use for client-side pagination |
| `withImmutableState` | Stable | No | Low | Low | Dev-time safety net |
| `withDataService` | Stable | No | Medium | Low | Evaluate for simple CRUD; too rigid for this workspace |
| `withResource` | Evolving | No | Medium | Low | Wait for Angular Resource API to stabilize |
| `withRedux` | Deprecated | No | High | None | Skip; use `@ngrx/signals/events` |

Sources: [ngrx-toolkit GitHub](https://github.com/angular-architects/ngrx-toolkit), [NgRx Toolkit v21](https://dev.to/ngrx-toolkit/ngrx-toolkit-v21-4l46)

---

## Summary

- **Day one features:** `withDevtools` (every store), `withCallState` (every async store), `updateState` (every state change). These are already standard in this workspace.
- **`withReset`** is a clean alternative to manual reset for full store resets. Consider adding to feature stores that need cleanup on logout.
- **`withUndoRedo`** adds value for form/editor experiences. Mind the memory overhead.
- **`withTrackedReducer`** bridges events and DevTools. Adopt when you expand the events layer.
- **`withStorageSync`** is useful for preferences. Be cautious with sensitive data.
- **`withDataService`** is too rigid for stores that need custom RxJS operators. This workspace's manual `rxMethod` pattern is more flexible.
- **`withRedux`** is deprecated. Use `@ngrx/signals/events` instead.
- **`withResource`** and mutations are evolving. Evaluate when Angular's Resource API matures.

Next: [Chapter 6: Store Patterns and Recipes](./06-store-patterns-and-recipes.md) shows how these features compose into real store implementations.
