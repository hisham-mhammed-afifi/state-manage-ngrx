# Chapter 3: Module Federation and Shared State

> `providedIn: 'root'` is necessary but not sufficient. Without webpack singleton sharing, each remote gets its own Angular, its own injector, and its own store instances.

This chapter explains how Module Federation's runtime sharing mechanism makes shared state work across independently compiled applications, and the specific traps that break it.

---

## 3.1 The Singleton Problem

In a traditional Angular application, `providedIn: 'root'` guarantees a single instance of a service. The entire app shares one root injector, and Angular creates the service the first time it is requested.

Module Federation breaks this guarantee. Each remote is a separately compiled webpack bundle. Without explicit configuration, each bundle ships its own copy of `@angular/core`, its own copy of `@ngrx/signals`, and its own copy of `@org/state-core`. At runtime, this means:

- The shell has an `AuthStore` instance with `isAuthenticated() === true`.
- The orders remote has a **different** `AuthStore` instance with `isAuthenticated() === false`.
- The nav bar (rendered by the shell) shows "Welcome, Alice." The orders page (rendered by the remote) shows "Please log in."

This happens because each copy of `@angular/core` creates its own root injector. Two root injectors mean two `AuthStore` instances, even though both are marked `providedIn: 'root'`.

### What Goes Wrong Without Singletons

```
┌─────────────────────────────────────────────────────┐
│  Browser Tab                                        │
│                                                     │
│  ┌─────────────────┐    ┌────────────────────────┐  │
│  │  Shell Bundle    │    │  Orders Remote Bundle  │  │
│  │                  │    │                        │  │
│  │  @angular/core ──┼──  │  @angular/core ◄─────  │  │
│  │  (copy A)        │    │  (copy B)              │  │
│  │                  │    │                        │  │
│  │  Root Injector A │    │  Root Injector B       │  │
│  │  └─ AuthStore ①  │    │  └─ AuthStore ②       │  │
│  │     (logged in)  │    │     (not logged in)    │  │
│  └─────────────────┘    └────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

Two copies of Angular means two injector trees. Two injector trees means two store instances. Signals in instance 1 do not notify consumers in instance 2.

### The Fix: Webpack Singleton Sharing

When a package is marked as `singleton: true` in the webpack shared configuration, Module Federation ensures only one copy is loaded at runtime. The first bundle to load the package "wins," and all other bundles reuse it.

```
┌─────────────────────────────────────────────────────┐
│  Browser Tab                                        │
│                                                     │
│  ┌─────────────────┐    ┌────────────────────────┐  │
│  │  Shell Bundle    │    │  Orders Remote Bundle  │  │
│  │                  │    │                        │  │
│  │  @angular/core ──┼────┼── shared (singleton)   │  │
│  │                  │    │                        │  │
│  │  Root Injector   │◄───┼── uses shell's         │  │
│  │  └─ AuthStore ①  │    │   injector             │  │
│  │     (logged in)  │    │                        │  │
│  └─────────────────┘    └────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

One copy of Angular, one root injector, one `AuthStore` instance. The orders remote calls `inject(AuthStore)` and gets the same instance the shell created.

Sources: [Pitfalls with Module Federation and Angular](https://www.angulararchitects.io/en/blog/pitfalls-with-module-federation-and-angular/), [Angular singleton service initiated multiple times](https://github.com/module-federation/module-federation-examples/issues/904)

---

## 3.2 The Shared Config Helper

The workspace centralizes singleton configuration in a single file: `tools/mf-shared.ts`.

```typescript
// tools/mf-shared.ts
import { SharedLibraryConfig } from '@nx/module-federation';

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

export function createSharedConfig(
  libName: string,
  defaultConfig: SharedLibraryConfig
): SharedLibraryConfig {
  if ((SHARED_SINGLETONS as readonly string[]).includes(libName)) {
    return { singleton: true, strictVersion: true, requiredVersion: 'auto' };
  }
  if (SHARED_SINGLETONS.some((s) => libName.startsWith(s + '/'))) {
    return { singleton: true, strictVersion: true, requiredVersion: 'auto' };
  }
  return defaultConfig;
}
```

### How It Works

The `shared` property of the Module Federation config accepts a function. Webpack calls this function once for every dependency it discovers during compilation, passing the package name and a default config. The function returns the config to use for that package.

`createSharedConfig` does three things:

1. **Exact match check:** If `libName` exactly matches an entry in `SHARED_SINGLETONS`, return singleton config.
2. **Subpath match check:** If `libName` starts with a singleton entry followed by `/`, return singleton config. This catches secondary entry points like `@angular/common/http`, `@ngrx/signals/entities`, `@ngrx/signals/rxjs-interop`, and `@ngrx/signals/events` without listing every subpath.
3. **Default passthrough:** For everything else, return webpack's default config (which typically means "shared but not singleton").

### The Three Config Fields

| Field | Value | Purpose |
|-------|-------|---------|
| `singleton` | `true` | Only one copy of this package may exist at runtime. If a remote tries to load a second copy, it is discarded. |
| `strictVersion` | `true` | If the shell's version and the remote's version are incompatible, throw a runtime error instead of silently using the wrong version. |
| `requiredVersion` | `'auto'` | Infer the required version from `package.json`. No manual version pinning needed. |

### Why `strictVersion: true` Matters

Without `strictVersion`, Module Federation silently falls back to whatever version is available. This can produce subtle bugs: a remote compiled against `@ngrx/signals@20` might load the shell's `@ngrx/signals@21` at runtime. If the API changed, methods may be missing or behave differently. `strictVersion: true` surfaces this as a build-time error, forcing you to align versions before deployment.

---

## 3.3 What Must Be in the Shared List

### Current SHARED_SINGLETONS Explained

| Package | Why It Must Be a Singleton |
|---------|---------------------------|
| `@angular/core` | One root injector, one change detection system, one zone. Without this, each remote runs its own Angular. |
| `@angular/common` | Common directives and pipes must share the same platform. |
| `@angular/common/http` | `HttpClient` interceptors registered in the shell must apply to HTTP calls made by remotes. Separate `HttpClient` instances skip the shell's `authInterceptor`. |
| `@angular/router` | One router manages all routes. Duplicate routers cause navigation chaos. |
| `@angular/forms` | Form modules must share validators and control state. |
| `@angular/platform-browser` | One platform instance per browser tab. Duplicates crash Angular. |
| `@ngrx/signals` | Signal stores must share the same signal implementation. Separate copies create signals invisible to each other's reactivity graph. |
| `@angular-architects/ngrx-toolkit` | `withDevtools` registers with one Redux DevTools instance. Duplicates cause double registration. |
| `@org/state-core` | The whole point: AuthStore, UserStore, AppStore, and cartEvents must be single instances. |
| `rxjs` | Observable chains must share the same `Subject` and `Observable` prototypes. Separate copies break `instanceof` checks and interop. |

### What Is NOT in the List (and Why)

| Package | Why Not Shared as Singleton |
|---------|----------------------------|
| `@org/feature-orders-state` | Feature stores are scoped to their remote. Sharing them would leak domain boundaries. |
| `@org/feature-products-state` | Same reason. The products remote owns this state. |
| `@org/feature-cart-state` | Cart state uses events for cross-remote communication through `@org/state-core`. The store itself lives in the cart remote. |
| `@org/models` | Type-only library. Types are erased at compile time and have no runtime representation. No singleton needed. |

**Exception: `@org/feature-cart-state`**

The cart state library has `scope:shared` tags (see Chapter 2), but it is not in `SHARED_SINGLETONS`. This is because cross-remote communication goes through `cartEvents` (defined in `@org/state-core`, which IS shared). The `CartStore` itself runs in the cart remote. Other remotes dispatch events; they do not directly inject the `CartStore`.

If your architecture evolves so that multiple remotes need to directly inject the `CartStore` (reading `cartStore.entities()` from the products remote, for example), you would need to add `@org/feature-cart-state` to `SHARED_SINGLETONS` and mark the `CartStore` with `providedIn: 'root'`. The current `CartStore` already has `providedIn: 'root'`, so only the webpack config change would be needed.

---

## 3.4 Shell and Remote Configuration

Every app in the workspace uses the same `createSharedConfig` function. This guarantees consistent singleton behavior across the shell and all remotes.

### Shell Configuration

```typescript
// apps/shell/module-federation.config.ts
import { ModuleFederationConfig } from '@nx/module-federation';
import { createSharedConfig } from '../../tools/mf-shared';

const config: ModuleFederationConfig = {
  name: 'shell',
  remotes: [],
  shared: createSharedConfig,
};

export default config;
```

The shell declares `remotes: []` because remotes are loaded dynamically at runtime, not statically at build time.

### Remote Configuration

```typescript
// apps/cart/module-federation.config.ts
import { ModuleFederationConfig } from '@nx/module-federation';
import { createSharedConfig } from '../../tools/mf-shared';

const config: ModuleFederationConfig = {
  name: 'cart',
  exposes: {
    './Routes': 'apps/cart/src/app/remote-entry/entry.routes.ts',
  },
  shared: createSharedConfig,
};

export default config;
```

Each remote exposes its routes via `./Routes`. The `shared` function is identical across all remotes. This is critical: if one remote uses a different shared config, it might load its own copy of Angular or `@ngrx/signals`, breaking singleton guarantees.

### Webpack Config

The `module-federation.config.ts` is consumed by the webpack config:

```typescript
// apps/cart/webpack.config.ts
import { withModuleFederation } from '@nx/module-federation/angular';
import config from './module-federation.config';

export default withModuleFederation(config, { dts: false });
```

`withModuleFederation` from `@nx/module-federation/angular` takes the MF config and produces a webpack configuration with the `ModuleFederationPlugin` configured. The `{ dts: false }` option disables the DTS plugin because Nx already provides typing support.

### Production Config

Remotes also have `webpack.prod.config.ts` files for overriding remote URLs in production:

```typescript
// apps/cart/webpack.prod.config.ts
import { withModuleFederation } from '@nx/module-federation/angular';
import config from './module-federation.config';

export default withModuleFederation(
  {
    ...config,
    // Remote overrides for production:
    // remotes: [
    //   ['app1', 'https://app1.example.com'],
    // ]
  },
  { dts: false },
);
```

---

## 3.5 Dynamic Remote Loading

The shell loads remotes at runtime, not at build time. This is a two-step process.

### Step 1: Register Remotes from Manifest

```typescript
// apps/shell/src/main.ts
import { registerRemotes } from '@module-federation/enhanced/runtime';

fetch('/module-federation.manifest.json')
  .then((res) => res.json())
  .then((remotes: Record<string, string>) =>
    Object.entries(remotes).map(([name, entry]) => ({ name, entry }))
  )
  .then((remotes) => registerRemotes(remotes))
  .then(() => import('./bootstrap').catch((err) => console.error(err)));
```

The manifest file maps remote names to their entry URLs. During development, Nx generates this file automatically. In production, you configure it to point to deployed remote URLs.

### Step 2: Load Remotes in Routes

```typescript
// apps/shell/src/app/app.routes.ts
import { loadRemote } from '@module-federation/enhanced/runtime';

export const appRoutes: Route[] = [
  {
    path: 'productsMf',
    loadChildren: () =>
      loadRemote<typeof import('productsMf/Routes')>('productsMf/Routes').then(
        (m) => m!.remoteRoutes
      ),
  },
  {
    path: 'orders',
    canActivate: [authGuard],
    loadChildren: () =>
      loadRemote<typeof import('orders/Routes')>('orders/Routes').then(
        (m) => m!.remoteRoutes
      ),
  },
  {
    path: 'cart',
    canActivate: [authGuard],
    loadChildren: () =>
      loadRemote<typeof import('cart/Routes')>('cart/Routes').then(
        (m) => m!.remoteRoutes
      ),
  },
  // ...
];
```

When the user navigates to `/orders`, Angular's router calls `loadChildren`, which triggers `loadRemote('orders/Routes')`. Module Federation downloads the orders remote bundle, resolves its shared dependencies against the shell's already-loaded packages, and returns the route configuration.

At this point, the singleton mechanism kicks in: the orders remote discovers that `@angular/core`, `@ngrx/signals`, and `@org/state-core` are already loaded by the shell. It reuses them instead of loading its own copies. The orders remote's components call `inject(AuthStore)` and get the shell's instance.

---

## 3.6 The DI Singleton Trap

Even with webpack singletons configured correctly, Angular's dependency injection has a subtlety that can create duplicate instances.

### The Trap: `providers` in Lazy-Loaded Routes

If a remote's route configuration provides a store in its `providers` array, Angular creates a child injector for that route. The child injector creates a new instance of the store, even though `providedIn: 'root'` already created one in the root injector.

```typescript
// BAD: This creates a second instance of OrdersStore
export const remoteRoutes: Route[] = [
  {
    path: '',
    providers: [OrdersStore],  // <-- Creates new child injector instance
    component: OrdersListComponent,
  },
];
```

The fix depends on the store's intended scope:

### Case 1: Store Should Be a Singleton (Core Stores)

Do NOT provide it in route `providers`. Rely on `providedIn: 'root'` and webpack singleton sharing.

```typescript
// GOOD: AuthStore is providedIn: 'root', no manual provider needed
export const remoteRoutes: Route[] = [
  {
    path: '',
    component: OrdersListComponent,
    // AuthStore is injected by the component, resolved from root injector
  },
];
```

### Case 2: Store Should Be Scoped to a Route (Feature Stores)

Provide it in the route's `providers` array. Do NOT use `providedIn: 'root'`.

```typescript
// GOOD: OrdersStore is scoped to this route tree
export const OrdersStore = signalStore(
  // No providedIn -- must be explicitly provided
  withDevtools('orders'),
  withState(initialOrdersState),
  // ...
);

export const remoteRoutes: Route[] = [
  {
    path: '',
    providers: [OrdersStore],  // Scoped to this route and its children
    children: [
      { path: '', component: OrdersListComponent },
      { path: ':id', component: OrderDetailComponent },
    ],
  },
];
```

When the user navigates away from `/orders`, Angular destroys the route's injector, which destroys the `OrdersStore` instance and cleans up any `rxMethod` subscriptions. This is the correct lifecycle for feature state.

### The Matrix

| Store Purpose | `providedIn: 'root'`? | In webpack singletons? | In route `providers`? |
|--------------|----------------------|----------------------|---------------------|
| Core store (auth, user, app) | Yes | Yes (via `@org/state-core`) | No |
| Feature store (orders, products) | No | No | Yes, at route level |
| Shared feature store (cart) | Yes | Not currently, uses events | No |

Sources: [Pitfalls with Module Federation and Angular](https://www.angulararchitects.io/en/blog/pitfalls-with-module-federation-and-angular/), [Tutorial: Getting Started with Webpack Module Federation and Angular](https://dev.to/manfredsteyer/tutorial-getting-started-with-webpack-module-federation-and-angular-2edd)

---

## 3.7 The Shell's Provider Setup

The shell's `app.config.ts` configures the providers that are available to the entire application, including remotes:

```typescript
// apps/shell/src/app/app.config.ts
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideDevtoolsConfig } from '@angular-architects/ngrx-toolkit';
import { appRoutes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideDevtoolsConfig({ name: 'State Management' }),
  ],
};
```

Key points:

- **`provideDevtoolsConfig({ name: 'State Management' })`** configures Redux DevTools for all stores in the application. This is called once in the shell. Remotes inherit it because they share the same `@angular-architects/ngrx-toolkit` instance.
- **`provideHttpClient(withInterceptors([authInterceptor]))`** registers the auth interceptor at the root level. Because `@angular/common/http` is a singleton, HTTP calls made by remotes also pass through this interceptor. This is how remotes get auth tokens attached to their API calls without any configuration.
- **Core stores are NOT listed in providers.** `AuthStore`, `UserStore`, and `AppStore` all use `providedIn: 'root'`, so Angular creates them on first injection. No manual provider registration is needed.

---

## 3.8 Verifying Singletons at Runtime

### Technique 1: Redux DevTools

If singleton sharing is working correctly, the Redux DevTools extension shows one entry per store. If you see duplicate entries (e.g., two "auth" stores), singleton sharing is broken.

Open Redux DevTools in the browser, select the "State Management" instance (from `provideDevtoolsConfig`), and check the store list. Each store name should appear exactly once.

### Technique 2: Console Logging in Store Hooks

Add a log to a core store's `onInit` hook:

```typescript
export const AuthStore = signalStore(
  { providedIn: 'root' },
  withDevtools('auth'),
  withState(initialAuthState),
  // ...
  withHooks({
    onInit() {
      console.log('AuthStore initialized', Date.now());
    },
  })
);
```

If the log fires once (when the shell bootstraps), singletons are working. If it fires again when a remote loads, the remote created its own instance.

### Technique 3: Instance Identity Check

In any remote component, verify that the injected store is the same instance:

```typescript
import { Component, inject } from '@angular/core';
import { AuthStore } from '@org/state-core';

@Component({ /* ... */ })
export class DebugComponent {
  private authStore = inject(AuthStore);

  constructor() {
    // This should log true if the remote shares the shell's instance
    console.log('isAuthenticated from remote:', this.authStore.isAuthenticated());

    // Compare with globalThis if you stash the shell's reference
    console.log('Same instance?', this.authStore === (globalThis as any).__debugAuthStore);
  }
}
```

In the shell, stash the reference:

```typescript
// Shell's AppComponent or similar (temporary debug code)
(globalThis as any).__debugAuthStore = inject(AuthStore);
```

If `Same instance?` logs `true`, singleton sharing works. Remove this debug code before committing.

---

## 3.9 Troubleshooting Singleton Failures

### Symptom: "Unsatisfied version" Error in Console

```
Unsatisfied version 21.0.0 of shared singleton module @ngrx/signals
  (required ^20.0.0)
```

**Cause:** The remote was compiled against a different major version of `@ngrx/signals` than the shell. `strictVersion: true` catches this.

**Fix:** Align versions across all apps. In an Nx monorepo with a single `package.json`, this happens automatically. The error typically appears when a remote is deployed from a different branch or an older CI artifact.

### Symptom: Store Works in Shell but Not in Remote

**Cause:** The package is missing from `SHARED_SINGLETONS`, or a secondary entry point is not covered by the `startsWith` check.

**Debug steps:**

1. Check if the package is in `SHARED_SINGLETONS`.
2. If the import uses a subpath (like `@ngrx/signals/events`), verify that the parent package (`@ngrx/signals`) is in the list. The `startsWith` check handles subpaths automatically.
3. Check that the remote's `module-federation.config.ts` uses the same `createSharedConfig` function. If a remote has its own shared config, it may not match.

### Symptom: HTTP Interceptor Not Firing in Remote

**Cause:** `@angular/common/http` is not shared as a singleton. The remote has its own `HttpClient` that does not know about the shell's interceptors.

**Fix:** Verify `@angular/common/http` is in `SHARED_SINGLETONS`. The `startsWith` check covers it because `@angular/common` is in the list and `@angular/common/http` starts with `@angular/common/`.

### Symptom: Two DevTools Entries for the Same Store

**Cause:** `@angular-architects/ngrx-toolkit` is not shared as a singleton, OR the remote calls `provideDevtoolsConfig()` separately.

**Fix:** Verify `@angular-architects/ngrx-toolkit` is in `SHARED_SINGLETONS`. Only the shell should call `provideDevtoolsConfig()`. Remotes inherit it through the shared injector.

---

## 3.10 Adding a New Shared Package

If you introduce a new library that must be a singleton across remotes (for example, a `libs/state/events` library in the future), add it to `SHARED_SINGLETONS`:

```typescript
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
  '@org/state-events',   // <-- New shared singleton
  'rxjs',
] as const;
```

No changes are needed to `createSharedConfig` or to any app's `module-federation.config.ts`. Because all apps use the same function, the new singleton is picked up automatically on the next build.

Ensure the new library also uses `providedIn: 'root'` for any services that should be singletons. The webpack config ensures one copy of the package; `providedIn: 'root'` ensures one instance of the service within that package.

Sources: [Micro Frontend Architecture | Nx](https://nx.dev/more-concepts/micro-frontend-architecture), [ModuleFederationPlugin | webpack](https://webpack.js.org/plugins/module-federation-plugin/)

---

## Summary

- **Webpack singleton sharing** ensures one copy of critical packages at runtime. Without it, each remote creates its own Angular, its own injector, and its own store instances.
- **`tools/mf-shared.ts`** centralizes the singleton list. The `createSharedConfig` function handles both exact matches and secondary entry points (subpaths).
- **All apps use the same shared config function.** Consistency is non-negotiable. If one remote uses a different config, singletons break.
- **`providedIn: 'root'`** is necessary but not sufficient. It tells Angular to create one instance per injector. Webpack singletons ensure there is only one injector.
- **Feature stores are intentionally NOT shared.** They are scoped to their remote via route-level providers.
- **Dynamic remote loading** with `@module-federation/enhanced/runtime` defers remote download until navigation. Shared packages are resolved at load time against what the shell already has.
- **Debug singletons** with Redux DevTools (one entry per store), `onInit` logging (fires once), or instance identity checks.

Next: [Chapter 4: NgRx Signal Store Deep Dive](./04-ngrx-signal-store-deep-dive.md) covers every API in the Signal Store with production context.
