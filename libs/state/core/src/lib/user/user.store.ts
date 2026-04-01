import { computed, effect, inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, withHooks } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { withDevtools, withCallState, setLoading, setLoaded, setError, updateState } from '@angular-architects/ngrx-toolkit';
import { pipe, switchMap, tap } from 'rxjs';
import { UserService } from './user.service';
import { UserProfile } from './user.model';
import { AuthStore } from '../auth/auth.store';

interface UserState {
  profile: UserProfile | null;
}

const initialUserState: UserState = {
  profile: null,
};

export const UserStore = signalStore(
  { providedIn: 'root' },
  withDevtools('user'),
  withState(initialUserState),
  withCallState(),
  withComputed((store) => ({
    displayName: computed(() => {
      const p = store.profile();
      return p ? `${p.firstName} ${p.lastName}` : '';
    }),
  })),
  withMethods((store) => {
    const userService = inject(UserService);

    return {
      loadUser: rxMethod<number>(
        pipe(
          tap(() => updateState(store, 'load user', setLoading())),
          switchMap((userId) =>
            userService.getProfile(userId).pipe(
              tap({
                next: (profile) =>
                  updateState(store, 'load user success', {
                    profile,
                    ...setLoaded(),
                  }),
                error: (error) =>
                  updateState(
                    store,
                    'load user error',
                    setError(error?.message ?? 'Failed to load user')
                  ),
              })
            )
          )
        )
      ),

      clear(): void {
        updateState(store, 'clear user', initialUserState);
      },
    };
  }),
  withHooks({
    onInit(store) {
      const authStore = inject(AuthStore);

      effect(() => {
        const userId = authStore.userId();
        if (userId) {
          store.loadUser(userId);
        } else {
          store.clear();
        }
      });
    },
  })
);
