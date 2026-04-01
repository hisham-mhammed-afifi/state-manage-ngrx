import { computed, effect, inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, withHooks } from '@ngrx/signals';
import { withEntities, setAllEntities, removeEntity, removeAllEntities } from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { withDevtools, withCallState, setLoading, setLoaded, setError, updateState } from '@angular-architects/ngrx-toolkit';
import { pipe, switchMap, tap, map } from 'rxjs';
import { CartItem } from './cart.model';
import { CartService } from './cart.service';
import { AuthStore } from '@org/state-core';

interface CartLocalState {
  cartId: number | null;
  cartTotal: number;
  cartDiscountedTotal: number;
}

export const CartStore = signalStore(
  withDevtools('cart'),
  withState<CartLocalState>({
    cartId: null,
    cartTotal: 0,
    cartDiscountedTotal: 0,
  }),
  withEntities<CartItem>(),
  withCallState(),
  withComputed((store) => ({
    totalItems: computed(() =>
      store.entities().reduce((sum, item) => sum + item.quantity, 0)
    ),
    totalPrice: computed(() =>
      store.entities().reduce((sum, item) => sum + item.total, 0)
    ),
    itemCount: computed(() => store.entities().length),
  })),
  withMethods((store) => {
    const cartService = inject(CartService);

    return {
      loadCart: rxMethod<number>(
        pipe(
          tap(() => updateState(store, 'load cart', setLoading())),
          switchMap((userId) =>
            cartService.getUserCarts(userId).pipe(
              map((response) => response.carts[0] ?? null),
              tap({
                next: (cart) => {
                  if (cart) {
                    updateState(
                      store,
                      'load cart success',
                      setAllEntities(cart.products),
                      {
                        cartId: cart.id,
                        cartTotal: cart.total,
                        cartDiscountedTotal: cart.discountedTotal,
                        ...setLoaded(),
                      }
                    );
                  } else {
                    updateState(store, 'no cart found', removeAllEntities(), {
                      cartId: null,
                      cartTotal: 0,
                      cartDiscountedTotal: 0,
                      ...setLoaded(),
                    });
                  }
                },
                error: (error) =>
                  updateState(
                    store,
                    'load cart error',
                    setError(error?.message ?? 'Failed to load cart')
                  ),
              })
            )
          )
        )
      ),

      removeItem(id: number): void {
        updateState(store, 'remove item', removeEntity(id));
      },

      clearCart(): void {
        updateState(store, 'clear cart', removeAllEntities(), {
          cartTotal: 0,
          cartDiscountedTotal: 0,
        });
      },
    };
  }),
  withHooks({
    onInit(store) {
      const authStore = inject(AuthStore);

      effect(() => {
        const userId = authStore.userId();
        if (userId) {
          store.loadCart(userId);
        }
      });
    },
  })
);
