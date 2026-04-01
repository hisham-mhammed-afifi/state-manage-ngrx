import { computed, effect, inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, withHooks } from '@ngrx/signals';
import { withEntities, setAllEntities } from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { withDevtools, withCallState, setLoading, setLoaded, setError, updateState } from '@angular-architects/ngrx-toolkit';
import { pipe, switchMap, tap } from 'rxjs';
import { Order } from './order.model';
import { OrdersService } from './orders.service';
import { AuthStore } from '@org/state-core';

interface OrdersLocalState {
  selectedId: number | null;
}

export const OrdersStore = signalStore(
  withDevtools('orders'),
  withState<OrdersLocalState>({
    selectedId: null,
  }),
  withEntities<Order>(),
  withCallState(),
  withComputed((store) => ({
    selectedOrder: computed(() => {
      const id = store.selectedId();
      return id ? store.entities().find((e) => e.id === id) ?? null : null;
    }),
    totalCount: computed(() => store.entities().length),
  })),
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
                  updateState(
                    store,
                    'load orders success',
                    setAllEntities(response.carts),
                    setLoaded()
                  ),
                error: (error) =>
                  updateState(
                    store,
                    'load orders error',
                    setError(error?.message ?? 'Failed to load orders')
                  ),
              })
            )
          )
        )
      ),

      selectOrder(id: number | null): void {
        updateState(store, 'select order', { selectedId: id });
      },
    };
  }),
  withHooks({
    onInit(store) {
      const authStore = inject(AuthStore);

      effect(() => {
        const userId = authStore.userId();
        if (userId) {
          store.loadOrders(userId);
        }
      });
    },
  })
);
