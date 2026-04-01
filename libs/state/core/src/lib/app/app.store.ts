import { computed } from '@angular/core';
import { signalStore, withState, withComputed, withMethods } from '@ngrx/signals';
import { withDevtools, updateState } from '@angular-architects/ngrx-toolkit';

interface AppState {
  initialized: boolean;
  maintenanceMode: boolean;
  version: string;
}

const initialAppState: AppState = {
  initialized: false,
  maintenanceMode: false,
  version: '0.0.0',
};

export const AppStore = signalStore(
  { providedIn: 'root' },
  withDevtools('app'),
  withState(initialAppState),
  withComputed((store) => ({
    isReady: computed(() => store.initialized() && !store.maintenanceMode()),
  })),
  withMethods((store) => ({
    markInitialized(): void {
      updateState(store, 'mark initialized', { initialized: true });
    },
    setMaintenanceMode(enabled: boolean): void {
      updateState(store, 'set maintenance mode', { maintenanceMode: enabled });
    },
    setVersion(version: string): void {
      updateState(store, 'set version', { version });
    },
  }))
);
