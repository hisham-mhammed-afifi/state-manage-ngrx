# Chapter 9: Future Growth

> The architecture is designed to evolve. This chapter covers what to add next, when to add it, and how the pieces fit together.

This chapter covers the events layer in depth, evaluates `withDataService` and `withStorageSync` for adoption, and provides a migration path from classic NgRx.

---

## 9.1 When to Add the Events Layer

The workspace already uses events for one workflow: `cartEvents` dispatched by the products remote and handled by the `CartStore`. This section helps you decide when to expand event usage.

### Direct Injection Is the Default

Most cross-store communication in this workspace uses direct injection:

```typescript
// UserStore injects AuthStore directly
withHooks({
  onInit(store) {
    const authStore = inject(AuthStore);
    effect(() => {
      const userId = authStore.userId();
      if (userId) store.loadUser(userId);
      else store.clear();
    });
  },
})
```

This is simple, type-safe, and easy to trace. The `UserStore` explicitly depends on `AuthStore`. There is no indirection.

### When Events Are Worth the Indirection

Add events when one or more of these conditions apply:

| Condition | Why Events Help |
|-----------|----------------|
| **Cross-remote communication** | The producer and consumer are in different webpack bundles. Direct injection would require sharing the consumer's store package. |
| **Multiple consumers** | Several stores need to react to the same action. With direct injection, the producer would need to know about all consumers. |
| **Decoupled domains** | The producer should not know (or care) who handles the event. Adding/removing a consumer does not change the producer. |
| **Audit/logging** | A global event stream makes it easy to log all state-changing actions in one place. |

### When Events Add Unnecessary Complexity

| Condition | Stay with Direct Injection |
|-----------|--------------------------|
| Both stores are in `libs/state/core` | Same library, same deployment unit. No decoupling needed. |
| Only one consumer exists | Events add indirection without benefit. |
| The reaction is synchronous and simple | `effect()` with `inject()` is clearer. |
| The stores are in the same remote | No cross-bundle boundary to cross. |

### The CartStore Case Study

The `CartStore` uses events because:

1. The "add to cart" action originates in the **products remote** (`apps/productsMf`).
2. The cart state lives in the **cart store** (`libs/feature/cart/state`).
3. Direct injection would require the products remote to import `@org/feature-cart-state`, creating a cross-remote compile-time dependency.
4. Events flow through `@org/state-core` (shared singleton), avoiding the dependency.

This is the textbook case for events: cross-remote, decoupled, and the producer does not need to know how the consumer processes the event.

---

## 9.2 Designing a state/events Library

If event usage grows beyond `cartEvents`, consider creating a dedicated `libs/state/events` library.

### Library Structure

```
libs/state/events/
├── src/
│   ├── index.ts
│   └── lib/
│       ├── cart.events.ts       # Moved from state/core
│       ├── order.events.ts      # New
│       └── notification.events.ts  # New
├── project.json
└── tsconfig.json
```

**Tags:** `type:state-core`, `scope:shared`

**Path alias:** `@org/state-events`

**Webpack singleton:** Add `@org/state-events` to `SHARED_SINGLETONS` in `tools/mf-shared.ts`.

### Event Naming Conventions

```typescript
import { type } from '@ngrx/signals';
import { eventGroup } from '@ngrx/signals/events';

// Pattern: source = domain name, events = past tense or imperative
export const orderEvents = eventGroup({
  source: 'Order',
  events: {
    placed: type<{ orderId: number; total: number }>(),
    cancelled: type<{ orderId: number; reason: string }>(),
    shipped: type<{ orderId: number; trackingNumber: string }>(),
  },
});
```

The `source` string becomes part of the event type: `[Order] placed`, `[Order] cancelled`. This makes events identifiable in DevTools and logs.

### Event Payload Design

Keep payloads minimal. Include only the data consumers need to react, not the entire entity:

```typescript
// GOOD: minimal payload
addToCart: type<{ id: number; title: string; price: number; discountPercentage: number; thumbnail: string }>()

// BAD: entire entity with fields the handler does not use
addToCart: type<FullProductEntity>()
```

---

## 9.3 Events API Deep Dive

All exports from `@ngrx/signals/events` v21.1.0, verified against installed type definitions.

### event() and eventGroup()

**`event(type)`** creates a single event creator:

```typescript
import { event } from '@ngrx/signals/events';

const increment = event('[Counter Page] Increment');              // void payload
const set = event('[Counter Page] Set', type<number>());          // number payload
```

**`eventGroup(config)`** creates a group of related event creators:

```typescript
import { type } from '@ngrx/signals';
import { eventGroup } from '@ngrx/signals/events';

const counterEvents = eventGroup({
  source: 'Counter Page',
  events: {
    increment: type<void>(),
    decrement: type<void>(),
    set: type<number>(),
  },
});

// counterEvents.increment() creates { type: '[Counter Page] increment', payload: undefined }
// counterEvents.set(42) creates { type: '[Counter Page] set', payload: 42 }
```

*Verified from installed package type definitions: `event(type)` and `event(type, payload)` return `EventCreator<Type, Payload>`. `eventGroup(config)` returns `EventCreatorGroup<Source, Events>`.*

### Dispatcher and injectDispatch

**`Dispatcher`** is a globally provided service for dispatching events:

```typescript
import { Dispatcher, event } from '@ngrx/signals/events';

@Component({ /* ... */ })
class Counter {
  private readonly dispatcher = inject(Dispatcher);

  increment(): void {
    this.dispatcher.dispatch(increment());
  }
}
```

**`injectDispatch(eventGroup)`** creates self-dispatching methods from an event group. This is the pattern used in the workspace:

```typescript
import { injectDispatch } from '@ngrx/signals/events';
import { cartEvents } from '@org/state-core';

@Component({ /* ... */ })
class ProductsPage {
  private readonly dispatch = injectDispatch(cartEvents);

  addToCart(product: Product): void {
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

`injectDispatch` wraps each event creator in a function that automatically dispatches when called. No need to manually call `dispatcher.dispatch()`.

*Verified from installed package type definitions: `injectDispatch<EventGroup>(events, config?): SelfDispatchingEvents<EventGroup>`. `Dispatcher` has a `dispatch(event, config?)` method.*

### provideDispatcher()

Creates scoped `Dispatcher` and `Events` instances for a component or route:

```typescript
@Component({
  providers: [provideDispatcher()],
})
class ScopedComponent {
  private readonly dispatcher = inject(Dispatcher);

  doSomething(): void {
    // Dispatches to the local Dispatcher (self scope)
    this.dispatcher.dispatch(someEvent());

    // Dispatches to the parent Dispatcher
    this.dispatcher.dispatch(someEvent(), { scope: 'parent' });

    // Dispatches to the global Dispatcher
    this.dispatcher.dispatch(someEvent(), { scope: 'global' });
  }
}
```

Without `provideDispatcher()`, all dispatches go to the global `Dispatcher`. With it, you get a scoped hierarchy.

*Verified from installed package type definitions: `provideDispatcher(): Provider[]`.*

### Events and ReducerEvents Services

**`Events`** is a globally provided service for listening to dispatched events:

```typescript
import { Events } from '@ngrx/signals/events';

// Inside withEventHandlers:
withEventHandlers((store, events = inject(Events)) => ({
  onAddToCart$: events.on(cartEvents.addToCart).pipe(
    tap(({ payload }) => { /* handle */ })
  ),
}))
```

**`ReducerEvents`** is identical but receives events **before** `Events`. It is used internally by `withReducer` to ensure state transitions happen before side effects.

| Service | Receives Events | Used By |
|---------|----------------|---------|
| `ReducerEvents` | First (before `Events`) | `withReducer` (state transitions) |
| `Events` | Second (after `ReducerEvents`) | `withEventHandlers` (side effects) |

This ordering guarantees that state is updated by `withReducer` before any `withEventHandlers` side effects read the new state.

*Verified from installed package type definitions: `Events extends BaseEvents`, `ReducerEvents extends BaseEvents`. Both have an `on(...events)` method returning `Observable`.*

### withEventHandlers vs withReducer

These two features serve different purposes:

**`withReducer`** defines pure state transitions in response to events:

```typescript
import { on, withReducer } from '@ngrx/signals/events';

export const CounterStore = signalStore(
  withState({ count: 0 }),
  withReducer(
    on(counterEvents.increment, (_, state) => ({ count: state.count + 1 })),
    on(counterEvents.decrement, (_, state) => ({ count: state.count - 1 })),
    on(counterEvents.set, ({ payload }) => ({ count: payload })),
  ),
);
```

The reducer function receives the event and current state, and returns a partial state update. No side effects, no `inject()`, no HTTP calls. Pure state transformation.

**`withEventHandlers`** defines side effects in response to events:

```typescript
import { Events, withEventHandlers } from '@ngrx/signals/events';

export const CartStore = signalStore(
  // ...
  withEventHandlers((store, events = inject(Events)) => ({
    onAddToCart$: events.on(cartEvents.addToCart).pipe(
      tap(({ payload }) => {
        // Side effect: update state with business logic
        updateState(store, 'add to cart', addEntity(/* ... */));
      })
    ),
  })),
);
```

| Aspect | `withReducer` | `withEventHandlers` |
|--------|-------------|-------------------|
| Purpose | Pure state transitions | Side effects (HTTP, logging, complex logic) |
| Input | Event + current state | Event (via RxJS pipe) |
| Output | Partial state update | Observable (side effect) |
| `inject()` available | No | Yes |
| Receives events via | `ReducerEvents` (first) | `Events` (second) |
| DevTools integration | Via `withTrackedReducer` (ngrx-toolkit) | Via `updateState` |
| When to use | Simple, predictable state changes | Complex logic, HTTP calls, cross-store coordination |

**In this workspace**, `CartStore` uses `withEventHandlers` because the add-to-cart logic involves a conditional branch (increment vs new item) and entity operations. For simpler events, `withReducer` would be cleaner.

*Verified from installed package type definitions: `withReducer(...caseReducers)` accepts `on()` results. `withEventHandlers(factory)` receives the store and returns `Record<string, Observable>`. The `on()` function for `withReducer` has signature: `on(...events, reducer)` where reducer receives `(event, state) => Partial<State>`.*

Sources: [Events - NgRx Signal Store](https://ngrx.io/guide/signals/signal-store/events), [The new Event API in NgRx Signal Store](https://www.angulararchitects.io/blog/the-new-event-api-in-ngrx-signal-store/), [Event-Driven State Management with NgRx Signal Store](https://dev.to/dimeloper/event-driven-state-management-with-ngrx-signal-store-j8i)

### Event Scoping

NgRx 21 introduced scoped events. Instead of broadcasting every event globally, you can scope events to a specific part of the app.

| Scope | Behavior | Use When |
|-------|----------|----------|
| `'self'` | Event is delivered only to the local `Dispatcher`'s `Events` service | Component-local events that should not leak to parents |
| `'parent'` | Event is delivered to the parent `Dispatcher` (one level up) | Bubbling events from a child scope to its parent |
| `'global'` | Event is delivered to the root `Dispatcher` | Cross-cutting concerns (logging, notifications, analytics) |

Without `provideDispatcher()`, all events are global by default. Scoping requires a `provideDispatcher()` hierarchy.

**Using toScope and mapToScope:**

```typescript
import { toScope, mapToScope } from '@ngrx/signals/events';

// toScope: mark a single event for a specific scope
this.dispatcher.dispatch(someEvent(), toScope('global'));

// mapToScope: RxJS operator to scope all events in a stream
events.on(someEvent).pipe(
  mapToScope('parent'),
)
```

*Verified from installed package type definitions: `toScope(scope: EventScope): EventScopeConfig`. `mapToScope<T>(scope: EventScope): OperatorFunction<T, [T, EventScopeConfig]>`. `EventScope = 'self' | 'parent' | 'global'`.*

Sources: [Announcing NgRx 21](https://dev.to/ngrx/announcing-ngrx-21-celebrating-a-10-year-journey-with-a-fresh-new-look-and-ngrxsignalsevents-5ekp), [NgRx SignalStore Events: The Power of Events](https://arcadioquintero.com/en/blog/ngrx-signalstore-events-plugin/)

---

## 9.4 Combining Events with ngrx-toolkit

### withTrackedReducer for DevTools

As covered in Chapter 5, `withTrackedReducer` from `@angular-architects/ngrx-toolkit` wraps `on()` reducers and sends named actions to Redux DevTools:

```typescript
import { on } from '@ngrx/signals/events';
import { withTrackedReducer } from '@angular-architects/ngrx-toolkit';

export const CartStore = signalStore(
  withState({ itemCount: 0 }),
  withEntities<CartItem>(),
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

Each event appears in DevTools with its type (e.g., `[Cart] addToCart`). This is the recommended approach when using `withReducer` in production, as bare `withReducer` does not integrate with DevTools.

---

## 9.5 withDataService Evaluation

`withDataService` from `@angular-architects/ngrx-toolkit` generates CRUD methods from a `DataService` interface (see Chapter 5 for the full API).

### When It Saves Time

- Simple admin panels with standard CRUD operations
- Feature stores where every entity needs load, create, update, delete
- Prototyping: get a working store quickly without writing `rxMethod` pipelines

### When It Constrains

- **Promise-based API:** Your services return Observables (`HttpClient`), requiring `firstValueFrom` wrappers
- **No RxJS operators:** No `debounceTime`, `switchMap` control, or retry logic
- **Fixed method signatures:** Cannot customize the load method to accept pagination params
- **Error handling:** Sets `callState` to error, but no customization of error messages

### Recommendation

For this workspace, the manual `rxMethod` pattern is the better fit. The stores need `switchMap` for search cancellation, `exhaustMap` for token refresh, and custom error message extraction. `withDataService` would require workarounds for all of these.

Consider `withDataService` for future simple CRUD features where the default behavior is genuinely sufficient.

---

## 9.6 withStorageSync for Token Persistence

### The Use Case

Currently, tokens are lost on page refresh. Adding `withStorageSync` to `AuthStore` would persist tokens across sessions:

```typescript
import { withStorageSync, withSessionStorage } from '@angular-architects/ngrx-toolkit';

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withDevtools('auth'),
  withState(initialAuthState),
  withCallState(),
  // ... withComputed, withMethods ...
  withStorageSync({
    key: 'auth',
    select: (state) => ({
      accessToken: state.accessToken,
      refreshToken: state.refreshToken,
      userId: state.userId,
    }),
  }, withSessionStorage()),
);
```

### Why sessionStorage over localStorage

| Aspect | `sessionStorage` | `localStorage` |
|--------|-----------------|---------------|
| Persistence | Cleared when tab closes | Permanent |
| XSS risk | Limited to session | Token persists indefinitely |
| Multiple tabs | Each tab has its own session | Shared across tabs |
| Use case | Auth tokens (auto-logout on tab close) | User preferences |

For auth tokens, `sessionStorage` is safer: if the user closes the tab, the tokens are gone. With `localStorage`, a stolen token persists until it expires or is manually cleared.

### Selective Persistence

The `select` option ensures only tokens are persisted, not `callState`:

```typescript
select: (state) => ({
  accessToken: state.accessToken,
  refreshToken: state.refreshToken,
  userId: state.userId,
})
```

Without `select`, the entire state (including `callState: 'loading'`) would be persisted, causing the store to initialize with a stale loading indicator.

### Hydration Flow

1. Store is created with `initialAuthState` (tokens are null).
2. `withStorageSync` reads from `sessionStorage` on init.
3. If tokens are found, state is patched with the persisted values.
4. `AuthStore.isAuthenticated()` becomes `true` immediately (no login call needed).
5. Components that depend on `isAuthenticated` render the authenticated view.

### Implementation Caution

Add `withStorageSync` **after** `withMethods`. The storage sync reads on init, which may trigger `effect()` hooks in `UserStore` (via `authStore.userId()` changing). Make sure all methods are defined before the state is hydrated.

---

## 9.7 Migration from Classic NgRx

If you are migrating a codebase from classic NgRx (`@ngrx/store`, `@ngrx/effects`), this table maps the concepts.

### Concept Mapping

| Classic NgRx | Signal Store Equivalent | Notes |
|--------------|------------------------|-------|
| `createAction('[Source] Name', props<T>())` | `eventGroup({ source, events })` or method in `withMethods` | Events for decoupled workflows; methods for direct API |
| `createReducer(initialState, on(...))` | `withReducer(on(...))` or `patchState`/`updateState` in methods | `withReducer` for event-driven; `updateState` for method-driven |
| `createSelector(selectFeature, ...)` | `withComputed(() => computed(...))` | Angular `computed()` replaces memoized selectors |
| `createEffect(() => actions$.pipe(...))` | `rxMethod(pipe(...))` or `withEventHandlers` | `rxMethod` for method-driven; `withEventHandlers` for event-driven |
| `StoreModule.forRoot()` | `signalStore({ providedIn: 'root' })` | No module registration. DI handles everything. |
| `StoreModule.forFeature()` | Route `providers: [FeatureStore]` | Scoped to route lifecycle |
| `store.select(selector)` | `store.signalName()` | Direct signal access, no `select()` needed |
| `store.dispatch(action)` | `store.method()` or `dispatch.eventName()` | Methods for direct calls; `injectDispatch` for events |
| `@ngrx/entity` | `withEntities()` from `@ngrx/signals/entities` | Same concept, signal-based API |
| `@ngrx/store-devtools` | `withDevtools()` from `@angular-architects/ngrx-toolkit` | Same DevTools extension, different integration |

### Step-by-Step Migration Strategy

**Phase 1: Coexist.** Classic NgRx and Signal Store can run side by side. They use different DI tokens and do not interfere.

```typescript
// Old: classic NgRx feature
StoreModule.forFeature('orders', ordersReducer),
EffectsModule.forFeature([OrdersEffects]),

// New: Signal Store (coexists without conflict)
providers: [OrdersSignalStore],
```

**Phase 2: Migrate feature by feature.** Start with the simplest feature store. Replace the reducer, selectors, effects, and actions with a single `signalStore`. Update the components that consume it.

**Phase 3: Remove classic NgRx.** Once all features are migrated, remove `@ngrx/store`, `@ngrx/effects`, and `@ngrx/store-devtools` from `package.json`.

### Before/After Example

**Classic NgRx:**

```typescript
// actions
export const loadOrders = createAction('[Orders] Load', props<{ userId: number }>());
export const loadOrdersSuccess = createAction('[Orders] Load Success', props<{ orders: Order[] }>());
export const loadOrdersFailure = createAction('[Orders] Load Failure', props<{ error: string }>());

// reducer
export const ordersReducer = createReducer(
  initialState,
  on(loadOrders, (state) => ({ ...state, loading: true })),
  on(loadOrdersSuccess, (state, { orders }) => adapter.setAll(orders, { ...state, loading: false })),
  on(loadOrdersFailure, (state, { error }) => ({ ...state, loading: false, error })),
);

// selectors
export const selectAllOrders = createSelector(selectOrdersState, adapter.getSelectors().selectAll);

// effects
loadOrders$ = createEffect(() => this.actions$.pipe(
  ofType(loadOrders),
  switchMap(({ userId }) => this.ordersService.getByUser(userId).pipe(
    map((orders) => loadOrdersSuccess({ orders })),
    catchError((error) => of(loadOrdersFailure({ error: error.message }))),
  )),
));
```

**Signal Store (equivalent):**

```typescript
export const OrdersStore = signalStore(
  withDevtools('orders'),
  withEntities<Order>(),
  withCallState(),
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
                  updateState(store, 'load orders success', setAllEntities(response.orders), setLoaded()),
                error: (error) =>
                  updateState(store, 'load orders error', setError(error.message)),
              })
            )
          )
        )
      ),
    };
  })
);
```

The Signal Store version is ~20 lines. The classic NgRx version is ~30+ lines across 4 files (actions, reducer, selectors, effects). The reduction comes from:

- No action boilerplate (3 actions become 1 method)
- No selector boilerplate (`withComputed` replaces `createSelector`)
- No effect class (rxMethod replaces `createEffect`)
- Entity adapter is built in (`withEntities` replaces `@ngrx/entity` setup)

---

## 9.8 Complete Events API Reference

All exports from `@ngrx/signals/events` v21.1.0:

| Export | Category | Description |
|--------|----------|-------------|
| `event` | Factory | Creates a single event creator |
| `eventGroup` | Factory | Creates a group of related event creators |
| `on` | Reducer | Creates a case reducer for `withReducer` |
| `withReducer` | Feature | Defines pure state transitions from events |
| `withEventHandlers` | Feature | Defines side effects from events |
| `Events` | Service | Listens to dispatched events (after `ReducerEvents`) |
| `ReducerEvents` | Service | Listens to dispatched events (before `Events`) |
| `Dispatcher` | Service | Dispatches events |
| `injectDispatch` | Helper | Creates self-dispatching event methods |
| `provideDispatcher` | Provider | Provides scoped Dispatcher/Events instances |
| `toScope` | Helper | Marks a single event for a specific scope |
| `mapToScope` | Operator | RxJS operator to scope all events in a stream |

*All exports verified from installed package type definitions in `node_modules/@ngrx/signals/types/ngrx-signals-events.d.ts`.*

---

## Summary

- **Events vs direct injection:** Default to direct injection for same-unit stores. Use events for cross-remote communication, multiple consumers, or decoupled domains.
- **`withReducer`** for pure state transitions. **`withEventHandlers`** for side effects. `ReducerEvents` fires first, `Events` second.
- **Event scoping** (`self`, `parent`, `global`) requires `provideDispatcher()` in the component hierarchy.
- **`withTrackedReducer`** (ngrx-toolkit) bridges events and DevTools. Use it when adopting `withReducer` in production.
- **`withDataService`:** Too rigid for this workspace's needs. Consider for simple CRUD in the future.
- **`withStorageSync`:** Good fit for user preferences. For auth tokens, use `sessionStorage` and `select` to persist only specific fields.
- **Classic NgRx migration:** Feature-by-feature replacement. Signal Store and classic NgRx coexist without conflict. Expect ~40% less code per feature.

---

This concludes the guide. For quick reference:

| Chapter | Topic |
|---------|-------|
| [01](./01-architecture-thinking.md) | Architecture Thinking |
| [02](./02-nx-workspace-design.md) | Nx Workspace Design |
| [03](./03-module-federation-and-shared-state.md) | Module Federation and Shared State |
| [04](./04-ngrx-signal-store-deep-dive.md) | NgRx Signal Store Deep Dive |
| [05](./05-ngrx-toolkit-in-production.md) | ngrx-toolkit in Production |
| [06](./06-store-patterns-and-recipes.md) | Store Patterns and Recipes |
| [07](./07-testing-state-libraries.md) | Testing State Libraries |
| [08](./08-devops-and-scaling.md) | DevOps and Scaling |
| [09](./09-future-growth.md) | Future Growth |
