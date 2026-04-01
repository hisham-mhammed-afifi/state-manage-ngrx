import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Product, ProductsResponse } from './product.model';

@Injectable({ providedIn: 'root' })
export class ProductsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'https://dummyjson.com/products';

  getAll(limit = 20, skip = 0): Observable<ProductsResponse> {
    return this.http.get<ProductsResponse>(
      `${this.baseUrl}?limit=${limit}&skip=${skip}`
    );
  }

  getById(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.baseUrl}/${id}`);
  }

  search(query: string): Observable<ProductsResponse> {
    return this.http.get<ProductsResponse>(
      `${this.baseUrl}/search?q=${encodeURIComponent(query)}`
    );
  }

  getCategories(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/category-list`);
  }

  getByCategory(category: string): Observable<ProductsResponse> {
    return this.http.get<ProductsResponse>(
      `${this.baseUrl}/category/${encodeURIComponent(category)}`
    );
  }
}
