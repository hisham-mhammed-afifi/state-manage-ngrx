import { computed, effect, inject } from '@angular/core';
import { signalStore, withComputed, withMethods, withHooks } from '@ngrx/signals';
import { withEntities, setAllEntities, addEntity, updateEntity, removeEntity, removeAllEntities } from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { Events, withEventHandlers } from '@ngrx/signals/events';
import { withDevtools, withCallState, setLoading, setLoaded, setError, updateState } from '@angular-architects/ngrx-toolkit';
import { pipe, switchMap, tap, map } from 'rxjs';
import { CartItem } from './cart.model';
import { CartService } from './cart.service';
import { AuthStore, cartEvents } from '@org/state-core';

export const CartStore = signalStore(
  { providedIn: 'root' },
  withDevtools('cart'),
  withEntities<CartItem>(),
  withCallState(),
  withComputed((store) => ({
    totalItems: computed(() =>
      store.entities().reduce((sum, item) => sum + item.quantity, 0)
    ),
    totalPrice: computed(() =>
      store.entities().reduce((sum, item) => sum + item.total, 0)
    ),
    totalDiscountedPrice: computed(() =>
      store.entities().reduce((sum, item) => sum + item.discountedTotal, 0)
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
                      setLoaded()
                    );
                  } else {
                    updateState(
                      store,
                      'no cart found',
                      removeAllEntities(),
                      setLoaded()
                    );
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
    };
  }),
  withEventHandlers((store, events = inject(Events)) => ({
    onAddToCart$: events.on(cartEvents.addToCart).pipe(
      tap(({ payload: product }) => {
        const existing = store.entityMap()[product.id];
        if (existing) {
          const quantity = existing.quantity + 1;
          const total = quantity * product.price;
          const discountedTotal = total * (1 - product.discountPercentage / 100);
          updateState(
            store,
            'add to cart (increment)',
            updateEntity<CartItem>({ id: product.id, changes: { quantity, total, discountedTotal } })
          );
        } else {
          const total = product.price;
          const discountedTotal = total * (1 - product.discountPercentage / 100);
          updateState(
            store,
            'add to cart (new item)',
            addEntity<CartItem>({
              id: product.id,
              title: product.title,
              price: product.price,
              quantity: 1,
              total,
              discountPercentage: product.discountPercentage,
              discountedTotal,
              thumbnail: product.thumbnail,
            })
          );
        }
      })
    ),
    onRemoveFromCart$: events.on(cartEvents.removeFromCart).pipe(
      tap(({ payload }) => {
        updateState(store, 'remove from cart', removeEntity(payload.id));
      })
    ),
    onClearCart$: events.on(cartEvents.clearCart).pipe(
      tap(() => {
        updateState(store, 'clear cart', removeAllEntities());
      })
    ),
  })),
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
