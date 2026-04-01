import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Cart } from './cart.model';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'https://dummyjson.com/carts';

  getUserCarts(userId: number): Observable<{ carts: Cart[] }> {
    return this.http.get<{ carts: Cart[] }>(`${this.baseUrl}/user/${userId}`);
  }

  getCart(cartId: number): Observable<Cart> {
    return this.http.get<Cart>(`${this.baseUrl}/${cartId}`);
  }
}
