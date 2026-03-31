# NgRx Signal Store & ngrx-toolkit Learning Path

A hands-on guide to understanding and practicing state management with NgRx Signal Store and the Angular Architects ngrx-toolkit. Every section gives you a full picture of what each piece does, why it exists, how it works internally, and where it fits before you go study it.

> **Project context:** Your state management plan uses a simplified day-one architecture: only `state/core` (AuthStore, UserStore, AppStore) and per-remote feature stores. No events library, no router store library, no `@ngrx/store`. The events plugin and some advanced toolkit features are deferred until concrete needs arise. This learning path covers everything including deferred topics, because understanding the full toolbox helps you make better decisions about when to introduce each piece.

---

## Part 1: NgRx Signal Store Fundamentals

You must understand Signal Store before touching the toolkit. The toolkit is a set of extensions (custom `signalStoreFeature` functions) that plug into the Signal Store API. If you don't know the base API, the extensions will feel like magic instead of tools you control.

---

### 1.1 What is NgRx Signal Store?

NgRx Signal Store is a lightweight, functional state management library built entirely on Angular Signals. It replaces the older Redux-based NgRx Store (actions, reducers, effects, selectors) with a single `signalStore()` function that composes features together.

Think of `signalStore()` like RxJS `pipe()`. You chain feature functions (like `withState`, `withMethods`, `withComputed`) in order, and each one receives the output of the previous one. The result is a dynamically generated Angular injectable service class with all your state, computed signals, and methods attached.

**What it replaces:** If you've used classic NgRx, Signal Store replaces `StoreModule`, `createAction`, `createReducer`, `createEffect`, and `createSelector` with a single file per store. No more bouncing between 5 files to trace a state change.

**How it works under the hood:** The `signalStore()` function is a factory. At runtime, it generates an Angular service class. Each feature function (`withState`, `withMethods`, etc.) adds properties or methods to that class. Because TypeScript understands the factory chain at compile time, you get full type safety even though the class is created dynamically.

**Key mental model:** A Signal Store is an injectable Angular service whose shape is defined by composing feature functions. It can be `providedIn: 'root'` (global singleton) or registered at component/route level (scoped lifetime).

**Study:**

- Official docs: https://ngrx.io/guide/signals/signal-store
- Deep dive article: https://www.stefanos-lignos.dev/posts/ngrx-signals-store

---

### 1.2 The Core Features (APIs you compose inside `signalStore()`)

These are the building blocks. Every store you write will use some combination of these.

#### `withState(initialState)`

Defines the store's state shape and initial values. Each property in the state object automatically becomes a nested Signal on the store instance. If your state is `{ count: 0, name: 'John' }`, the store exposes `store.count()` (returns `0`) and `store.name()` (returns `'John'`) as individual signals.

State updates happen through `patchState(store, partialState)`, which immutably merges changes. In dev mode, `patchState` deep-freezes the state to catch accidental mutations.

#### `withComputed(factory)`

Defines derived state. Takes a factory function that receives the store's current signals and returns an object of `computed()` signals. These re-evaluate automatically when their dependencies change, similar to RxJS selectors but without manual memoization.

Example: `isAuthenticated` derived from `accessToken() !== null`.

#### `withMethods(factory)`

Defines the store's public API (imperative actions). Takes a factory function that receives the store and returns an object of methods. Methods can call `patchState` to update state, call other services via `inject()`, or trigger side effects.

The factory runs inside an injection context, so `inject()` works directly in the factory body for getting services.

#### `withHooks({ onInit, onDestroy })`

Lifecycle hooks for the store. `onInit` runs when the store is first injected (created). `onDestroy` runs when the store's injector is destroyed (e.g., when a component-level store's component is destroyed).

Common use: calling a `loadData()` method automatically when the store initializes, so components don't have to remember to trigger it. Also used for cross-store reactivity: `onInit` can inject another store and set up an `effect()` that watches its signals.

#### `withProps(factory)`

Adds arbitrary properties (including signals, observables, or plain values) to the store. Unlike `withComputed` (which only takes computed signals), `withProps` can hold anything. Useful for injecting services or creating `toSignal()` conversions from observables.

#### `rxMethod<T>(operator)`

Bridges RxJS into Signal Store. It creates a method that accepts either a static value, a Signal, or an Observable, and processes it through an RxJS operator chain. When you pass a Signal, it automatically tracks changes and re-runs the operator chain.

Use when you need RxJS operators like `switchMap`, `debounceTime`, `exhaustMap` for HTTP calls. Skip it for simple synchronous updates.

#### `signalMethod<T>(processor)`

Signal-only alternative to `rxMethod`. Creates a method that accepts a static value or Signal and runs a processor function. No RxJS involved. Use for simple side effects where you don't need operators.

**Study:**

- Official Signal Store guide: https://ngrx.io/guide/signals/signal-store
- `signalMethod` docs: https://ngrx.io/guide/signals/signal-method

---

### 1.3 Entity Management (`@ngrx/signals/entities`)

When your store manages a collection of objects (orders, users, products, flights), manually maintaining an array with `patchState(store, { items: [...items, newItem] })` gets tedious. The entities package provides normalized collection management out of the box.

#### `withEntities<EntityType>()`

Adds a normalized entity collection to the store. Internally stores entities in a `Record<id, Entity>` (an entity map) plus an ordered `ids` array. Exposes three signals:

- `store.entities()` returns the full array
- `store.entityMap()` returns the `Record<id, Entity>` for O(1) lookup by ID
- `store.ids()` returns the ordered ID array

#### Entity Updaters

Pure functions you pass to `patchState`:

- `setAllEntities(entities)` replaces the entire collection
- `addEntity(entity)` / `addEntities(entities)` adds one or many
- `updateEntity({ id, changes })` patches a single entity by ID
- `updateEntities({ predicate, changes })` patches multiple matching a condition
- `removeEntity(id)` / `removeEntities(ids)` removes one or many
- `removeAllEntities()` clears the collection

#### `entityConfig({ entity, collection, selectId })`

Configures custom ID fields (if your entity uses `_id` instead of `id`) and named collections (if one store manages multiple entity types).

**Study:**

- Official entities docs: https://ngrx.io/guide/signals/signal-store/entity-management

---

### 1.4 Events Plugin (`@ngrx/signals/events`)

> **Project context:** The events plugin is deferred in your project. Most remotes are independent and communicate only with core state via direct injection. Learn this section to understand the API for when a cross-remote workflow eventually requires it.

The events plugin brings decoupled, Flux-style communication to Signal Store. Instead of Store A injecting Store B and calling its methods, Store A dispatches an event and Store B reacts independently.

#### Key APIs

- `eventGroup({ source, events })` -- defines typed events with payloads
- `provideDispatcher()` -- provides the global event bus (called in shell config)
- `injectDispatch(eventGroup)` -- returns a dispatcher in a component or store
- `withEffects(factory)` -- defines reactive handlers inside a store that listen to events
- `withReducer(eventGroup, on(event, reducerFn))` -- pure state updates in response to events

#### Scoped Dispatching

Events can target different scopes: `{ scope: 'global' }` reaches all stores, `{ scope: 'parent' }` reaches the parent injector only, default reaches local scope.

**When to add it to your project:** When you hit a concrete case like "order created in remote-orders must trigger a refresh in remote-dashboard." Not before.

**Study:**

- Event-driven Signal Store: https://dev.to/dimeloper/event-driven-state-management-with-ngrx-signal-store-j8i
- Angular Architects events article: https://www.angulararchitects.io/blog/the-new-event-api-in-ngrx-signal-store/
- NgRx 21 announcement: https://dev.to/ngrx/announcing-ngrx-21-celebrating-a-10-year-journey-with-a-fresh-new-look-and-ngrxsignalsevents-5ekp

---

### 1.5 Practice: Clone and Study Real Apps

**Rainer Hahnekamp's demo:**

- Repo: https://github.com/rainerhahnekamp/ngrx-signal-store-demo
- Look at: `/src/app/customers/data` and `/src/app/customers/feature/customer-container.component.ts`

**RealWorld example app (Medium.com clone):**

- Repo: https://github.com/stefanoslig/angular-ngrx-nx-realworld-example-app
- Built with Angular 21, NgRx 21, Nx. Has auth, CRUD, routing, pagination with Signal Store.

**Video:**

- Rainer Hahnekamp's talk: https://www.youtube.com/watch?v=yaOLbKwVRtc

---

## Part 2: ngrx-toolkit

The toolkit is maintained by the Angular Architects team (Manfred Steyer, Rainer Hahnekamp). Rainer is on the NgRx core team. The package provides reusable `signalStoreFeature` functions.

**Install:** `pnpm add @angular-architects/ngrx-toolkit`

**Docs:** https://ngrx-toolkit.angulararchitects.io/docs/extensions

**Demo app repo:** https://github.com/angular-architects/ngrx-toolkit (run with `pnpm install && pnpm start`)

---

### 2.1 `withDevtools(name)` -- Redux DevTools Integration

**What it does:** Connects your Signal Store to the Redux DevTools browser extension. Every state change appears in the DevTools timeline.

**Why you need it:** Signal Store has no built-in DevTools support. Without this, debugging means console.log everywhere.

**How it works:** Subscribes to the store's state signal via an `effect()`. Every state change is serialized and sent to the DevTools extension API.

**API:**

- `withDevtools('name')` -- basic integration
- `withDevtools('name', withGlitchTracking())` -- tracks every intermediate state change
- `updateState(store, 'actionName', partialState)` -- labels changes with action names in DevTools
- `renameDevtoolsName(store, 'newName')` -- dynamic rename for component-level stores
- `withMapper(fn)` -- strip sensitive data before sending to DevTools

**Placement:** Always first feature after `providedIn` config.

**Study:** https://ngrx-toolkit.angulararchitects.io/docs/with-devtools

---

### 2.2 `withCallState()` -- Loading/Error State Tracking

**What it does:** Adds `callState` tracking with states: `init`, `loading`, `loaded`, `{ error: string }`. Exposes computed signals: `store.loading()`, `store.loaded()`, `store.error()`.

**Why you need it:** Every store with HTTP calls needs loading/error state. This eliminates hand-rolling it in every store.

**API:**

- `withCallState()` -- unnamed, adds `callState`, `loading`, `loaded`, `error`
- `withCallState({ collection: 'todos' })` -- named, adds `todosCallState`, `todosLoading`, etc.
- `withCallState({ collections: ['todos', 'users'] })` -- multiple collections
- `setLoading()` / `setLoaded()` / `setError(error)` -- helper functions for `patchState`

**Study:** https://ngrx-toolkit.angulararchitects.io/docs/with-call-state

---

### 2.3 `withDataService(config)` -- CRUD Backend Sync

**What it does:** Connects a backend service implementing the `DataService` interface to a `withEntities` store. Auto-generates load, create, update, delete methods with call state tracking.

**Important caveat:** The `DataService` interface uses **Promises**, not Observables. If your services use `HttpClient` (which returns Observables), you need `firstValueFrom()` wrappers.

**API:** Requires `withEntities` on the store. Optionally enriched by `withCallState` and `withUndoRedo`.

**Study:** https://ngrx-toolkit.angulararchitects.io/docs/with-data-service

---

### 2.4 `withReset()` -- Reset to Initial State

**What it does:** Adds `store.resetState()` to restore the entire store to its initial values. One call, everything cleared.

**Use case:** Logout cleanup. When a user logs out, call `resetState()` on feature stores to wipe cached data.

**Study:** https://ngrx-toolkit.angulararchitects.io/docs/with-reset

---

### 2.5 `withUndoRedo(config)` -- Undo/Redo Stack

**What it does:** Maintains a history stack of state snapshots. `store.undo()` reverts, `store.redo()` goes forward. Exposes `canUndo()` and `canRedo()` signals.

**Config:** `maxStackSize` (default 100), `collections` (entity collections to track), `keys` (non-entity state keys), `skip` (initial changes to ignore).

**Study:** https://ngrx-toolkit.angulararchitects.io/docs/with-undo-redo

---

### 2.6 `withStorageSync(config)` -- Persist State to Browser Storage

**What it does:** Reads state from `localStorage`/`sessionStorage`/`IndexedDB` on init, writes on every change. State survives page refreshes.

**Config:** `key` (storage key), `autoSync` (boolean), `select` (pick which properties to persist), `stringify`/`parse` (custom serialization).

**Backends:** Default `localStorage`, `withSessionStorage()`, `withIndexedDB()` (async).

**Study:** https://ngrx-toolkit.angulararchitects.io/docs/with-storage-sync

---

### 2.7 Other Toolkit Features

| Feature                 | What it does                                        | When to learn                        |
| ----------------------- | --------------------------------------------------- | ------------------------------------ |
| `withImmutableState()`  | Deep-freezes state in production mode too           | When onboarding new team members     |
| `withResource()`        | Connects Angular's Resource API to Signal Store     | When Angular Resource API stabilizes |
| `withEntityResources()` | Same but for entity collections                     | After withResource                   |
| Mutations API           | Write-side counterpart to withResource              | After withResource                   |
| `withConditional()`     | Feature flags for store features                    | Advanced use cases                   |
| `withRedux()`           | **Deprecated.** Use `@ngrx/signals/events` instead. | Skip                                 |

---

## Part 3: Architecture Context

### 3.1 Signal Store and Architecture

Manfred Steyer's article covers where stores belong in large apps:

- Feature layer (scoped to a feature), domain layer (shared within a domain), UI layer (component-level)
- Lightweight stores should not access each other directly across domains. Use a service or events.
- One store per bounded context, not one giant global store.

Your project follows this: `state/core` is the domain layer for cross-cutting concerns, feature stores are the feature layer, and the events pattern (when added) is the domain bridge.

**Read:** https://www.angulararchitects.io/blog/the-ngrx-signal-store-and-your-architecture/

### 3.2 Custom Features Deep Dive

Shows how `withCallState`, `withDataService`, `withUndoRedo` are built internally using `signalStoreFeature()`. After this, you can write your own custom features.

**Read:** https://www.angulararchitects.io/blog/smarter-not-harder-simplifying-your-application-with-ngrx-signal-store-and-custom-features/

---

## Part 4: Practice Exercises

### Exercise 1: Bare Signal Store

Build a `CounterStore` with `withState`, `withComputed`, `withMethods`. Increment, decrement, reset.

### Exercise 2: Add Entities

Build a `TodoStore` with `withEntities<Todo>()`. Add, toggle, remove todos using entity updaters.

### Exercise 3: Add DevTools + Call State

Add `withDevtools('todos')` and `withCallState()`. Simulate async load. Watch in Redux DevTools.

### Exercise 4: Cross-Store Reactivity (direct injection)

Build an `AuthStore` and a `UserStore`. UserStore injects AuthStore in `withHooks({ onInit })` and uses `effect()` to react to `authStore.userId()` changes. This is the pattern your project uses.

### Exercise 5: Feature Store with withEntities + CRUD

Build an `OrdersStore` with `withEntities`, `withCallState`, `withDevtools`, `withHooks`. Full CRUD with mock HTTP. This matches your project's feature store template.

### Exercise 6: Add withReset + Logout Flow

Add `withReset()` to the feature store. Trigger reset when AuthStore logs out (detected via effect on `authStore.isAuthenticated()`).

### Exercise 7: Events (for future reference)

Build a second store. Define an `eventGroup`. Dispatch from one, react with `withEffects` in the other. This prepares you for when the events layer is needed.

### Exercise 8: Add withStorageSync

Persist auth tokens to localStorage. Reload the page. Verify hydration works.

---

## Part 5: Priority Map

| Feature                                      | Priority for your project | Reason                                                           |
| -------------------------------------------- | ------------------------- | ---------------------------------------------------------------- |
| `withState` / `withComputed` / `withMethods` | Day one                   | Every store uses these                                           |
| `withHooks`                                  | Day one                   | Store initialization + cross-store reactivity via effect()       |
| `withEntities`                               | Day one                   | All feature stores manage collections                            |
| `rxMethod`                                   | Day one                   | HTTP flows in stores                                             |
| `withDevtools`                               | Day one                   | Debugging from day one                                           |
| `withCallState`                              | Day one                   | Loading/error in every store                                     |
| `withReset`                                  | Day one                   | Logout cleanup                                                   |
| `signalMethod`                               | This week                 | Simple side effects without RxJS                                 |
| `withProps`                                  | This week                 | Service injection pattern                                        |
| `withDataService`                            | Evaluate                  | Major boilerplate reduction, but requires Promise-based services |
| `withStorageSync`                            | Evaluate                  | If tokens need client-side persistence                           |
| `@ngrx/signals/events`                       | When needed               | Only when cross-remote communication is required                 |
| `withUndoRedo`                               | When needed               | Form editors, builders                                           |
| `withImmutableState`                         | When needed               | Training/safety net                                              |
| `withResource` / Mutations                   | Later                     | Angular Resource API is new                                      |
| `withConditional`                            | Later                     | Advanced feature flagging                                        |
| `withRedux`                                  | Skip                      | Deprecated                                                       |

---

## Reference Links

**Official NgRx:**

- Signal Store docs: https://ngrx.io/guide/signals/signal-store
- Entities: https://ngrx.io/guide/signals/signal-store/entity-management
- signalMethod: https://ngrx.io/guide/signals/signal-method

**ngrx-toolkit:**

- Docs: https://ngrx-toolkit.angulararchitects.io/docs/extensions
- GitHub: https://github.com/angular-architects/ngrx-toolkit

**Articles:**

- Stefanos Lignos deep dive: https://www.stefanos-lignos.dev/posts/ngrx-signals-store
- Architecture guide: https://www.angulararchitects.io/blog/the-ngrx-signal-store-and-your-architecture/
- Custom features: https://www.angulararchitects.io/blog/smarter-not-harder-simplifying-your-application-with-ngrx-signal-store-and-custom-features/
- Events API: https://www.angulararchitects.io/blog/the-new-event-api-in-ngrx-signal-store/

**Example apps:**

- Rainer's demo: https://github.com/rainerhahnekamp/ngrx-signal-store-demo
- RealWorld app: https://github.com/stefanoslig/angular-ngrx-nx-realworld-example-app
- StackBlitz playground: https://stackblitz.com/edit/github-xcfx2qc1

**Video:**

- Rainer Hahnekamp's Signal Store talk: https://www.youtube.com/watch?v=yaOLbKwVRtc
