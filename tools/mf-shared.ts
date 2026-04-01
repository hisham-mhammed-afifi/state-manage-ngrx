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
    return { singleton: true, strictVersion: true, requiredVersion: 'auto' };
  }
  if (SHARED_SINGLETONS.some((s) => libName.startsWith(s + '/'))) {
    return { singleton: true, strictVersion: true, requiredVersion: 'auto' };
  }
  return defaultConfig;
}
