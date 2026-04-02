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
): SharedLibraryConfig{
  if ((SHARED_SINGLETONS as readonly string[]).includes(libName)) {
    return { singleton: true, strictVersion: false, requiredVersion: false };
  }
  if (SHARED_SINGLETONS.some((s) => libName.startsWith(s + '/'))) {
    return { singleton: true, strictVersion: false, requiredVersion: false };
  }
  return defaultConfig;
}

/**
 * Patches the final webpack config to replace any `requiredVersion: 'auto'`
 * in shared/consume plugins. Nx leaves 'auto' unresolved on the consume side
 * which causes Federation Runtime errors in production.
 */
// patchAutoVersions removed — use tools/patch-auto-versions.mjs as a post-build step instead
