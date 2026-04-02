# State Management POC

An Angular monorepo demonstrating **NgRx Signal Store** state management across a **Module Federation** micro-frontend architecture, built with **Nx**.

## Apps

| App | Description | Port |
|-----|-------------|------|
| `shell` | Host app (entry point) | 4200 |
| `cart` | Cart remote | 4203 |
| `orders` | Orders remote | 4201 |
| `productsMf` | Products remote | 4202 |
| `api` | Backend API | 3000 |

## Libraries

| Library | Purpose |
|---------|---------|
| `@org/state-core` | Shared singleton stores (auth, user, app, cart events) |
| `@org/feature-cart-state` | Cart feature state |
| `@org/feature-orders-state` | Orders feature state |
| `@org/feature-products-state` | Products feature state |

## Quick Start

```bash
# Install dependencies
npm install

# Serve everything (shell + all remotes)
npx nx serve shell

# Serve a single remote
npx nx serve cart
```

Open http://localhost:4200.

## Build

```bash
# Build all apps
npx nx run-many -t build

# Build a single app
npx nx build shell
```

## Test & Lint

```bash
npx nx run-many -t test
npx nx run-many -t lint
```

## Project Graph

```bash
npx nx graph
```

## Deployment

See [docs/deployment.md](docs/deployment.md) for the full Vercel deployment guide.

## Guide

The app includes a built-in state management guide at `/guide`. Serve the shell and navigate to http://localhost:4200/guide.

Guide source files are in [docs/guide/](docs/guide/).

## Tech Stack

- Angular 21
- Nx (monorepo tooling)
- NgRx Signal Store + ngrx-toolkit
- Module Federation (@nx/module-federation)
- PrismJS (syntax highlighting)
- Mermaid (diagrams)
