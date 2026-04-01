import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Order, OrdersResponse } from './order.model';

@Injectable({ providedIn: 'root' })
export class OrdersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'https://dummyjson.com/carts';

  getByUser(userId: number): Observable<OrdersResponse> {
    return this.http.get<OrdersResponse>(`${this.baseUrl}/user/${userId}`);
  }

  getById(id: number): Observable<Order> {
    return this.http.get<Order>(`${this.baseUrl}/${id}`);
  }
}
