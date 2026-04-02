# Chapter 2: Nx Workspace Design

> The library structure is the architecture. If the folder layout is wrong, no amount of code review will save you.

This chapter covers how the Nx workspace enforces the boundaries described in Chapter 1. It explains the library taxonomy, the tag system, path aliases, and how to generate new libraries that follow the conventions.

---

## 2.1 Library Taxonomy

Every library in the workspace has two tag dimensions: **type** (what kind of code it contains) and **scope** (which domain or deployment unit it belongs to).

### Type Tags

| Type Tag | Purpose | Can Import From | Example |
|----------|---------|----------------|---------|
| `type:state-core` | Shared state stores (auth, user, app flags) | `type:state-core`, `type:data` | `libs/state/core` |
| `type:state-feature` | Feature-scoped state stores | `type:state-core`, `type:state-feature`, `type:data` | `libs/feature/orders/state` |
| `type:feature` | Smart components, routes, use-case orchestration | `type:feature`, `type:state-feature`, `type:state-core`, `type:data`, `type:ui` | `libs/shop/feature-products` |
| `type:ui` | Presentational components, pipes, directives | `type:ui`, `type:data` | `libs/shop/shared-ui` |
| `type:data` | Models, interfaces, DTOs, API services | `type:data` | `libs/shared/models` |

The dependency flow is strictly top-down:

```
feature
  ├── state-feature
  │     └── state-core
  │           └── data
  ├── ui
  │     └── data
  └── data
```

A `type:ui` library cannot import a store. A `type:state-feature` library cannot import a UI component. A `type:data` library cannot import anything except other data libraries. These constraints are enforced at lint time, not just by convention.

### Scope Tags

| Scope Tag | Deployment Unit | Can Import From |
|-----------|----------------|----------------|
| `scope:shared` | Available to all | `scope:shared` only |
| `scope:shell` | Shell application | `scope:shell`, `scope:shared` |
| `scope:orders` | Orders remote | `scope:orders`, `scope:shared` |
| `scope:products` | Products remote | `scope:products`, `scope:shared` |
| `scope:cart` | Cart remote | `scope:cart`, `scope:shared` |
| `scope:shop` | Shop application (SSR) | `scope:shop`, `scope:shared` |
| `scope:api` | API server | `scope:api`, `scope:shared` |

Scope tags prevent cross-remote imports. The orders remote cannot import from `scope:products`. Both can import from `scope:shared`.

---

## 2.2 The Workspace Map

Here is every library in the workspace with its tags and import alias:

| Library | Path | Tags | Import Alias |
|---------|------|------|-------------|
| state-core | `libs/state/core` | `type:state-core`, `scope:shared` | `@org/state-core` |
| feature-orders-state | `libs/feature/orders/state` | `type:state-feature`, `scope:orders` | `@org/feature-orders-state` |
| feature-products-state | `libs/feature/products/state` | `type:state-feature`, `scope:products` | `@org/feature-products-state` |
| feature-cart-state | `libs/feature/cart/state` | `type:state-feature`, `scope:shared` | `@org/feature-cart-state` |
| models | `libs/shared/models` | `type:data`, `scope:shared` | `@org/models` |
| products (API) | `libs/api/products` | `scope:api` | `@org/api/products` |
| data (shop) | `libs/shop/data` | `type:data`, `scope:shop` | `@org/shop/data` |
| feature-products (shop) | `libs/shop/feature-products` | `type:feature`, `scope:shop` | `@org/shop/feature-products` |
| feature-product-detail (shop) | `libs/shop/feature-product-detail` | `type:feature`, `scope:shop` | `@org/shop/feature-product-detail` |
| shared-ui (shop) | `libs/shop/shared-ui` | `type:ui`, `scope:shop` | `@org/shop/shared-ui` |

Notice that `feature-cart-state` has `scope:shared` even though it is a feature store. This is because the cart must be accessible from multiple remotes (the products remote dispatches `addToCart` events). This is the exception that proves the rule: most feature stores use the scope of their owning remote.

---

## 2.3 Tags and Boundary Enforcement

The boundary rules live in `eslint.config.mjs` under the `@nx/enforce-module-boundaries` rule. There are two enforcement dimensions: scope constraints and type constraints.

### The Actual Configuration

```javascript
// eslint.config.mjs
'@nx/enforce-module-boundaries': [
  'error',
  {
    enforceBuildableLibDependency: true,
    allow: [
      '^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$',
      '^.*/tools/mf-shared$',
    ],
    depConstraints: [
      // --- Scope constraints ---
      { sourceTag: 'scope:shared',   onlyDependOnLibsWithTags: ['scope:shared'] },
      { sourceTag: 'scope:shop',     onlyDependOnLibsWithTags: ['scope:shop', 'scope:shared'] },
      { sourceTag: 'scope:api',      onlyDependOnLibsWithTags: ['scope:api', 'scope:shared'] },
      { sourceTag: 'scope:shell',    onlyDependOnLibsWithTags: ['scope:shell', 'scope:shared'] },
      { sourceTag: 'scope:orders',   onlyDependOnLibsWithTags: ['scope:orders', 'scope:shared'] },
      { sourceTag: 'scope:products', onlyDependOnLibsWithTags: ['scope:products', 'scope:shared'] },
      { sourceTag: 'scope:cart',     onlyDependOnLibsWithTags: ['scope:cart', 'scope:shared'] },

      // --- Type constraints ---
      { sourceTag: 'type:data',          onlyDependOnLibsWithTags: ['type:data'] },
      { sourceTag: 'type:state-core',    onlyDependOnLibsWithTags: ['type:state-core', 'type:data'] },
      { sourceTag: 'type:state-feature', onlyDependOnLibsWithTags: ['type:state-core', 'type:state-feature', 'type:data'] },
      { sourceTag: 'type:feature',       onlyDependOnLibsWithTags: ['type:feature', 'type:state-feature', 'type:state-core', 'type:data', 'type:ui'] },
      { sourceTag: 'type:ui',            onlyDependOnLibsWithTags: ['type:ui', 'type:data'] },
    ],
  },
],
```

### How Constraints Are Evaluated

A library has multiple tags. Both its scope and type constraints must be satisfied. For a dependency to be allowed, it must pass **all** constraints that apply to the source library's tags.

**Example:** `feature-orders-state` has tags `type:state-feature` and `scope:orders`.

- The `type:state-feature` constraint allows imports from `type:state-core`, `type:state-feature`, and `type:data`.
- The `scope:orders` constraint allows imports from `scope:orders` and `scope:shared`.

For `feature-orders-state` to import `state-core`, the target must satisfy both: `state-core` has `type:state-core` (passes type check) and `scope:shared` (passes scope check). This import is allowed.

For `feature-orders-state` to import `feature-products-state`: the target has `type:state-feature` (passes type check) but `scope:products` (fails scope check, since `scope:orders` can only depend on `scope:orders` or `scope:shared`). This import is **blocked**.

### The `allow` Escape Hatch

Two patterns are explicitly exempted from boundary checks:

```javascript
allow: [
  '^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$',  // ESLint configs
  '^.*/tools/mf-shared$',                           // MF shared config helper
],
```

The `tools/mf-shared` exemption is necessary because the Module Federation shared config helper is imported by webpack configs in every app, regardless of scope. Without this exemption, the orders remote could not import `tools/mf-shared` because it has no scope tag.

### `enforceBuildableLibDependency`

When set to `true`, this option ensures that if a library declares itself as buildable (has a `build` target), all its dependencies must also be buildable. Currently, none of the libraries in this workspace are buildable, so this acts as a safety net for future additions.

Sources: [Enforce Module Boundaries | Nx](https://nx.dev/docs/features/enforce-module-boundaries), [Taming Code Organization with Module Boundaries in Nx](https://nx.dev/blog/mastering-the-project-boundaries-in-nx)

---

## 2.4 Path Aliases and the Barrel Pattern

### tsconfig.base.json Paths

Every library has a path alias defined in `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@org/state-core": ["libs/state/core/src/index.ts"],
      "@org/feature-orders-state": ["libs/feature/orders/state/src/index.ts"],
      "@org/feature-products-state": ["libs/feature/products/state/src/index.ts"],
      "@org/feature-cart-state": ["libs/feature/cart/state/src/index.ts"],
      "@org/models": ["libs/shared/models/src/index.ts"],
      "@org/api/products": ["libs/api/products/src/index.ts"],
      "@org/shop/data": ["libs/shop/data/src/index.ts"],
      "@org/shop/feature-products": ["libs/shop/feature-products/src/index.ts"],
      "@org/shop/feature-product-detail": ["libs/shop/feature-product-detail/src/index.ts"],
      "@org/shop/shared-ui": ["libs/shop/shared-ui/src/index.ts"]
    }
  }
}
```

Each alias points to the library's `src/index.ts` barrel file. This file is the library's public API. Everything exported from it is available to consumers; everything not exported is internal.

### Why `@org/state-core` and Not `@org/state/core`

The alias format uses a hyphen (`state-core`) rather than a slash (`state/core`). This is intentional:

1. **Webpack Module Federation** treats slashes in shared package names as subpath patterns. `@org/state/core` could be misinterpreted as a subpath of `@org/state`.
2. **Consistency** with npm package naming conventions, where scoped packages use `@scope/package-name`.
3. **The `createSharedConfig` helper** in `tools/mf-shared.ts` uses `startsWith` to match secondary entry points (like `@angular/common/http`). A flat alias avoids false matches.

### The Barrel File

A typical state library barrel exports the store, models, and any public utilities:

```typescript
// libs/state/core/src/index.ts
export { AuthStore } from './lib/auth/auth.store';
export { UserStore } from './lib/user/user.store';
export { AppStore } from './lib/app/app.store';
export { cartEvents, type CartProduct } from './lib/cart-events/cart.events';
export type { AuthState, LoginCredentials } from './lib/auth/auth.model';
export type { UserState } from './lib/user/user.model';
export type { AppState } from './lib/app/app.model';
```

Internal implementation details like `AuthService`, `UserService`, or helper functions are not exported. Consumers interact with the store's public methods, not the services behind them.

---

## 2.5 Generating New Libraries

### Creating a New Feature State Library

To create a state library for a new remote (e.g., "notifications"):

```bash
pnpm nx g @nx/angular:library \
  --name=state \
  --directory=libs/feature/notifications/state \
  --tags="type:state-feature,scope:notifications" \
  --standalone \
  --skipModule
```

This generates:

```
libs/feature/notifications/state/
├── src/
│   ├── index.ts              # Barrel file (public API)
│   └── lib/                  # Implementation directory
├── project.json              # Nx project config with tags
├── tsconfig.json             # Extends tsconfig.base.json
├── tsconfig.lib.json         # Library build config
├── tsconfig.spec.json        # Test config
└── vite.config.mts           # Vitest config (from generator defaults)
```

After generation, manually add the path alias to `tsconfig.base.json`:

```json
"@org/feature-notifications-state": ["libs/feature/notifications/state/src/index.ts"]
```

And add the scope constraint to `eslint.config.mjs`:

```javascript
{
  sourceTag: 'scope:notifications',
  onlyDependOnLibsWithTags: ['scope:notifications', 'scope:shared'],
},
```

### Generator Defaults

The workspace configures Angular generators in `nx.json`:

```json
{
  "generators": {
    "@nx/angular:application": {
      "e2eTestRunner": "playwright",
      "linter": "eslint",
      "style": "css",
      "unitTestRunner": "vitest-analog"
    },
    "@nx/angular:library": {
      "linter": "eslint",
      "unitTestRunner": "vitest-analog"
    },
    "@nx/angular:component": {
      "style": "css"
    }
  }
}
```

All libraries use **Vitest with Analog** as the unit test runner. This is set at the workspace level, so individual generator commands do not need to specify it.

---

## 2.6 The project.json Anatomy

Each library has a `project.json` that declares its name, root, tags, and targets.

```json
// libs/feature/orders/state/project.json
{
  "$schema": "../../../../node_modules/nx/schemas/project-schema.json",
  "name": "feature-orders-state",
  "projectType": "library",
  "sourceRoot": "libs/feature/orders/state/src",
  "prefix": "lib",
  "tags": ["type:state-feature", "scope:orders"],
  "targets": {}
}
```

Key fields:

| Field | Purpose |
|-------|---------|
| `name` | Unique project identifier used in `nx run`, `nx affected`, and dependency graph |
| `tags` | Array of strings used by `@nx/enforce-module-boundaries` for constraint checking |
| `targets` | Build/test/lint/serve targets. Most libs inherit lint and test from plugins in `nx.json` |
| `sourceRoot` | Root directory for source files, used by generators and test runners |

Targets are often empty (`{}`) because the Nx plugins registered in `nx.json` (like `@nx/eslint/plugin` and `@nx/vitest`) infer targets automatically from configuration files in the project root.

---

## 2.7 Dependency Graph

The `nx graph` command visualizes dependencies between projects:

```bash
pnpm nx graph
```

This opens an interactive browser UI showing the dependency graph. For state libraries, the graph reveals:

- **`state-core`** is depended on by the shell, all remotes, and all feature state libraries. A change to `state-core` triggers `nx affected` for the entire workspace.
- **`feature-orders-state`** is depended on by the orders remote only. A change here triggers `nx affected` for `orders` and nothing else.
- **`feature-cart-state`** is depended on by the cart remote and potentially the products remote (if products dispatches cart events). Its `scope:shared` tag reflects this wider dependency.
- **`models`** is a leaf dependency. Many libraries depend on it, but it depends on nothing.

### Targeted Graph

To see just the dependencies of a specific project:

```bash
pnpm nx graph --focus=state-core
```

This filters the graph to show only `state-core` and the projects that depend on it, which is useful for understanding the blast radius of a change.

### Understanding Affected

`nx affected` uses the dependency graph to determine which projects are impacted by a code change. This is critical for CI:

| What Changed | Affected Projects | Lint | Test | Build |
|-------------|-------------------|------|------|-------|
| `libs/state/core/src/lib/auth/auth.store.ts` | state-core, shell, orders, productsMf, cart, all feature states | All | All | All apps |
| `libs/feature/orders/state/src/lib/orders.store.ts` | feature-orders-state, orders | orders only | orders only | orders only |
| `libs/shared/models/src/lib/product.model.ts` | models, all consumers of models | All | All | All apps |
| `apps/cart/src/app/remote-entry/entry.routes.ts` | cart | cart only | cart only | cart only |

This is why the library taxonomy matters: a well-scoped library minimizes the blast radius of changes.

Sources: [Enforce Module Boundaries | Nx](https://nx.dev/docs/features/enforce-module-boundaries), [Three Ways to Enforce Module Boundaries](https://www.stefanos-lignos.dev/posts/nx-module-boundaries)

---

## 2.8 Naming Conventions

### Library Directories

| Domain | Directory Pattern | Example |
|--------|------------------|---------|
| Core state | `libs/state/core` | Auth, User, App stores |
| Feature state | `libs/feature/<domain>/state` | `libs/feature/orders/state` |
| API/data services | `libs/api/<domain>` | `libs/api/products` |
| Shared models | `libs/shared/models` | DTOs, interfaces |

### Store Files

Inside a state library, each store follows this structure:

```
libs/feature/orders/state/src/lib/
├── orders.store.ts          # The signalStore definition
├── orders.model.ts          # State interface and types
├── orders.service.ts         # HTTP service (injected by the store)
└── orders.store.spec.ts      # Tests
```

### Import Alias Convention

| Library Type | Alias Pattern | Example |
|-------------|---------------|---------|
| Core state | `@org/state-core` | `import { AuthStore } from '@org/state-core'` |
| Feature state | `@org/feature-<domain>-state` | `import { OrdersStore } from '@org/feature-orders-state'` |
| Models | `@org/models` | `import { Product } from '@org/models'` |
| API services | `@org/api/<domain>` | `import { ProductsService } from '@org/api/products'` |

---

## Summary

- **Two tag dimensions** (type + scope) enforce both layer and domain boundaries at lint time.
- **Type tags** control the dependency direction: data at the bottom, features at the top.
- **Scope tags** prevent cross-remote imports: each remote can only reach its own scope and `scope:shared`.
- **Path aliases** point to barrel files, which are the public API of each library.
- **Generators** create libraries with the correct structure, but you must manually add path aliases and scope constraints.
- **`nx graph`** and **`nx affected`** use the same dependency information, so a well-scoped library means faster CI.

Next: [Chapter 3: Module Federation and Shared State](./03-module-federation-and-shared-state.md) covers how webpack singleton sharing makes core stores work across remotes.
