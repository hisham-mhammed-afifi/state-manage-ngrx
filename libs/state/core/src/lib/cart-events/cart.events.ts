import { type } from '@ngrx/signals';
import { eventGroup } from '@ngrx/signals/events';

export interface CartProduct {
  id: number;
  title: string;
  price: number;
  thumbnail: string;
  discountPercentage: number;
}

export const cartEvents = eventGroup({
  source: 'Cart',
  events: {
    addToCart: type<CartProduct>(),
    removeFromCart: type<{ id: number }>(),
    clearCart: type<void>(),
  },
});
