# Chapter 8: DevOps and Scaling

> The library taxonomy from Chapter 2 pays off in CI. A well-scoped library means faster pipelines, smaller blast radii, and confident deployments.

This chapter covers `nx affected` for state libraries, CI pipeline design, adding new remotes and feature state libraries, and performance monitoring.

---

## 8.1 nx affected for State Libraries

`nx affected` determines which projects have been impacted by a code change by analyzing the dependency graph. For state libraries, this means:

- A change to `libs/state/core` affects **everything**: every app and every feature state library depends on it.
- A change to `libs/feature/orders/state` affects **only the orders remote**.
- A change to `libs/shared/models` affects **every consumer of models**, which is most of the workspace.

### Change Impact Matrix

| What Changed | Affected Libraries | Affected Apps | Blast Radius |
|-------------|-------------------|---------------|-------------|
| `libs/state/core/src/lib/auth/auth.store.ts` | state-core, all feature states | shell, orders, productsMf, cart | Full workspace |
| `libs/state/core/src/lib/cart-events/cart.events.ts` | state-core, feature-cart-state | shell, productsMf, cart | Moderate |
| `libs/feature/orders/state/src/lib/orders.store.ts` | feature-orders-state | orders | Minimal |
| `libs/feature/products/state/src/lib/products.store.ts` | feature-products-state | productsMf | Minimal |
| `libs/shared/models/src/lib/product.model.ts` | models, all consumers | Most apps | Large |
| `tools/mf-shared.ts` | None (allow-listed) | All MF apps (via webpack config) | Full workspace |
| `apps/cart/src/app/remote-entry/entry.routes.ts` | None | cart | Minimal |

### Running Affected Commands

```bash
# See what's affected by changes since main
pnpm nx affected -t lint,test,build --base=main

# See affected projects only (no execution)
pnpm nx show projects --affected --base=main

# Visualize the affected graph
pnpm nx affected --graph --base=main
```

### Why state-core Has Maximum Blast Radius

The dependency graph shows that `state-core` is a transitive dependency of every app:

```
shell ──► state-core
orders ──► feature-orders-state ──► state-core
productsMf ──► feature-products-state ──► state-core
cart ──► feature-cart-state ──► state-core
```

Any change to `state-core` (even a comment change) triggers lint, test, and build for the entire workspace. This is correct behavior: if `AuthStore` changes, every consumer should be re-tested.

**Mitigation:** Keep `state-core` stable. Move experimental or frequently-changing state to feature libraries where the blast radius is smaller.

---

## 8.2 CI Pipeline Design

### GitHub Actions Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  main:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint affected
        run: pnpm nx affected -t lint --base=origin/main

      - name: Test affected
        run: pnpm nx affected -t test --base=origin/main

      - name: Build affected
        run: pnpm nx affected -t build --base=origin/main
```

### Key Pipeline Decisions

| Decision | Why |
|----------|-----|
| `fetch-depth: 0` | `nx affected` needs the full git history to compare against `main`. |
| `--base=origin/main` | Compare against the remote `main` branch, not the local one. |
| `--frozen-lockfile` | Fail if `pnpm-lock.yaml` is out of date. Prevents accidental dependency changes. |
| Lint, test, build in sequence | Lint is fast and catches issues early. Tests run next. Build runs last (slowest). |

### Caching with Nx

Nx caches task results based on inputs (source files, config files, environment variables). The `nx.json` `namedInputs` and `targetDefaults` configure this:

```json
// From nx.json
{
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "production": [
      "default",
      "!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)",
      "!{projectRoot}/tsconfig.spec.json",
      "!{projectRoot}/src/test-setup.[jt]s"
    ]
  },
  "targetDefaults": {
    "@nx/angular:webpack-browser": {
      "cache": true,
      "dependsOn": ["^build"],
      "inputs": ["production", "^production", { "env": "NX_MF_DEV_REMOTES" }]
    },
    "@nx/vitest:test": {
      "cache": true,
      "inputs": ["default", "^production"]
    }
  }
}
```

Key caching rules:

- **Build** uses `production` inputs, which exclude test files. Changing a `.spec.ts` file does not invalidate the build cache.
- **Test** uses `default` inputs (includes test files) and `^production` (production inputs from dependencies). A test file change invalidates the test cache but not the build cache.
- **Build depends on `^build`:** A project's build depends on its dependencies' builds completing first.

### Nx Cloud (Optional)

For distributed caching across CI runs and developer machines:

```bash
pnpm nx connect
```

This enables remote caching: if another developer or CI run already built `state-core`, subsequent runs reuse the cached result. This is particularly valuable for `state-core`, which triggers rebuilds of every app.

Sources: [Faster Builds with Module Federation | Nx](https://nx.dev/docs/technologies/module-federation/concepts/faster-builds-with-module-federation), [Module Federation and Nx](https://nx.dev/docs/technologies/module-federation/concepts/module-federation-and-nx)

---

## 8.3 Adding a New Remote

Step-by-step process for adding a new Module Federation remote (e.g., "notifications").

### Step 1: Generate the Application

```bash
pnpm nx g @nx/angular:remote notifications \
  --host=shell \
  --port=4204 \
  --style=css
```

This generates:
- `apps/notifications/` with Module Federation config
- Updates `apps/shell/module-federation.config.ts` to reference the new remote (if using static remotes)
- Creates `apps/notifications/src/app/remote-entry/entry.routes.ts`

### Step 2: Configure Shared Singletons

Ensure the new remote uses the same `createSharedConfig`:

```typescript
// apps/notifications/module-federation.config.ts
import { ModuleFederationConfig } from '@nx/module-federation';
import { createSharedConfig } from '../../tools/mf-shared';

const config: ModuleFederationConfig = {
  name: 'notifications',
  exposes: {
    './Routes': 'apps/notifications/src/app/remote-entry/entry.routes.ts',
  },
  shared: createSharedConfig,
};

export default config;
```

### Step 3: Create the Feature State Library

```bash
pnpm nx g @nx/angular:library \
  --name=state \
  --directory=libs/feature/notifications/state \
  --tags="type:state-feature,scope:notifications" \
  --standalone \
  --skipModule
```

### Step 4: Add Path Alias

Add to `tsconfig.base.json`:

```json
"@org/feature-notifications-state": ["libs/feature/notifications/state/src/index.ts"]
```

### Step 5: Add Scope Constraint

Add to `eslint.config.mjs` in the `depConstraints` array:

```javascript
{
  sourceTag: 'scope:notifications',
  onlyDependOnLibsWithTags: ['scope:notifications', 'scope:shared'],
},
```

### Step 6: Add Route in Shell

Add a route in `apps/shell/src/app/app.routes.ts`:

```typescript
{
  path: 'notifications',
  loadChildren: () =>
    loadRemote<typeof import('notifications/Routes')>('notifications/Routes').then(
      (m) => m!.remoteRoutes
    ),
},
```

And add the type declaration in `apps/shell/src/decl.d.ts` (or similar):

```typescript
declare module 'notifications/Routes';
```

### Step 7: Add to Manifest

If using dynamic remotes, add the entry to `module-federation.manifest.json`:

```json
{
  "notifications": "http://localhost:4204/remoteEntry.js"
}
```

### Step 8: Verify

```bash
# Lint to verify boundary rules
pnpm nx lint notifications

# Build the new remote
pnpm nx build notifications

# Serve everything
pnpm nx serve shell
```

---

## 8.4 Adding a New Feature State Library

For adding state to an existing remote (e.g., adding "settings" state to the shell).

### Step 1: Generate the Library

```bash
pnpm nx g @nx/angular:library \
  --name=state \
  --directory=libs/feature/settings/state \
  --tags="type:state-feature,scope:shell" \
  --standalone \
  --skipModule
```

### Step 2: Add Path Alias

```json
"@org/feature-settings-state": ["libs/feature/settings/state/src/index.ts"]
```

### Step 3: Create the Store

```typescript
// libs/feature/settings/state/src/lib/settings.store.ts

import { signalStore, withState, withMethods } from '@ngrx/signals';
import { withDevtools, updateState } from '@angular-architects/ngrx-toolkit';

interface SettingsState {
  theme: 'light' | 'dark';
  language: string;
  notificationsEnabled: boolean;
}

const initialState: SettingsState = {
  theme: 'light',
  language: 'en',
  notificationsEnabled: true,
};

export const SettingsStore = signalStore(
  withDevtools('settings'),
  withState(initialState),
  withMethods((store) => ({
    setTheme(theme: 'light' | 'dark'): void {
      updateState(store, 'set theme', { theme });
    },
    setLanguage(language: string): void {
      updateState(store, 'set language', { language });
    },
    toggleNotifications(): void {
      updateState(store, 'toggle notifications', (s) => ({
        notificationsEnabled: !s.notificationsEnabled,
      }));
    },
  }))
);
```

### Step 4: Export from Barrel

```typescript
// libs/feature/settings/state/src/index.ts
export { SettingsStore } from './lib/settings.store';
```

### Step 5: Provide at Route Level

```typescript
// In the settings route configuration
{
  path: 'settings',
  providers: [SettingsStore],
  component: SettingsPageComponent,
}
```

---

## 8.5 Performance Monitoring

### Detecting Duplicate Angular Instances

A duplicated Angular instance is the most common Module Federation problem. Symptoms: stores have different state in different remotes, interceptors do not fire, or DevTools shows duplicate store entries.

**Check at runtime:**

```typescript
// Temporary debug code in any component
console.log('Angular version:', VERSION.full);
console.log('Number of platforms:', (window as any).__ng_platform_count ?? 'unknown');
```

**Check via DevTools:**
- Open Redux DevTools. Count store entries. If "auth" appears twice, singletons are broken.
- Open browser DevTools console. Look for warnings about multiple Angular instances.

### Build Bundle Analysis

Analyze what each remote includes in its bundle:

```bash
# Build with stats
pnpm nx build productsMf --stats-json

# Analyze with webpack-bundle-analyzer (install separately)
npx webpack-bundle-analyzer apps/productsMf/dist/stats.json
```

Look for:
- `@angular/core` appearing in a remote's bundle (should be shared, not bundled)
- `@ngrx/signals` appearing in a remote's bundle (should be shared)
- `@org/state-core` appearing in a remote's bundle (should be shared)

If shared packages appear in a remote's bundle, the singleton configuration is not working. Check `tools/mf-shared.ts` and the remote's `module-federation.config.ts`.

### Signal Change Detection Performance

Signal Stores use Angular's signal-based reactivity. Each `computed()` signal only re-evaluates when its dependencies change. This is inherently efficient, but watch for:

1. **Large entity collections in computed:** A `computed` that iterates over thousands of entities on every change is expensive. Use `withEntities` named collections to split large datasets.

2. **Deeply nested state:** Deep signals add overhead. Keep state shapes flat when possible.

3. **Excessive cross-store effects:** Each `effect()` in `withHooks` creates a reactive listener. A store with many effects watching many signals can create a cascade of updates. Profile with Angular DevTools if you suspect performance issues.

### Monitoring in Production

Track these metrics for state management health:

| Metric | How to Measure | Warning Threshold |
|--------|---------------|-------------------|
| Store initialization time | Log timestamp in `onInit` hooks | > 100ms |
| Entity count per store | Log `entities().length` periodically | > 10,000 items |
| HTTP call duration | Track in `rxMethod` pipelines (add timing operators) | > 2s for data loads |
| DevTools state size | Check in Redux DevTools | > 1MB (use `withMapper` to reduce) |

---

## 8.6 Deployment Considerations

### Independent Remote Deployment

Module Federation enables deploying remotes independently of the shell. This means:

1. **Version alignment matters.** The shell and all remotes must use compatible versions of shared packages. `strictVersion: true` catches mismatches at runtime.

2. **The manifest file controls which remote versions are loaded.** Update `module-federation.manifest.json` to point to new remote URLs after deployment.

3. **Feature state libraries deploy with their remote.** Since `@org/feature-orders-state` is not in `SHARED_SINGLETONS`, it is bundled into the orders remote and deploys with it.

4. **Core state deploys with the shell.** Since `@org/state-core` is a shared singleton, its code is included in the shell's bundle. Remotes reuse the shell's copy at runtime.

### Deployment Checklist

| Step | Command/Action | Verify |
|------|---------------|--------|
| Run affected tests | `pnpm nx affected -t test --base=main` | All tests pass |
| Run affected lint | `pnpm nx affected -t lint --base=main` | No lint errors |
| Build affected apps | `pnpm nx affected -t build --base=main` | Build succeeds |
| Check bundle contents | `webpack-bundle-analyzer` | No shared packages in remote bundles |
| Deploy remote(s) | Upload to CDN/server | Remote accessible at configured URL |
| Update manifest | Point to new remote URL(s) | Shell loads new remote version |
| Smoke test | Navigate through all remotes | Auth works, stores sync, no console errors |

### Rollback Strategy

If a remote deployment breaks:

1. **Revert the manifest.** Point back to the previous remote URL. The shell loads the old version immediately.
2. **Investigate.** Check if a shared package version mismatch caused the issue (`strictVersion` errors in console).
3. **Fix and redeploy.** Align versions, rebuild, and deploy again.

The shell never needs redeployment to roll back a remote. This is a key advantage of dynamic remote loading.

---

## Summary

- **`nx affected`** uses the dependency graph to minimize CI work. A change to `state-core` rebuilds everything; a change to a feature state only rebuilds its remote.
- **CI pipeline:** lint -> test -> build, all using `nx affected --base=origin/main`. Enable caching for speed.
- **Adding a new remote:** Generate app, configure shared singletons, create feature state lib, add path alias, add scope constraint, add route in shell, update manifest.
- **Adding a feature state lib:** Generate lib, add path alias, create store, export from barrel, provide at route level.
- **Performance:** Watch for duplicate Angular instances, oversized entity collections, and shared packages appearing in remote bundles.
- **Deployment:** Remotes deploy independently. The manifest controls which versions load. Core state deploys with the shell. Rollback by reverting the manifest.

Next: [Chapter 9: Future Growth](./09-future-growth.md) covers when to add the events layer, storage sync, and migration from classic NgRx.
