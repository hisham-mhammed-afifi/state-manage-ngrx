import { computed, inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, withHooks } from '@ngrx/signals';
import { withEntities, setAllEntities } from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { withDevtools, withCallState, setLoading, setLoaded, setError, updateState } from '@angular-architects/ngrx-toolkit';
import { pipe, switchMap, tap } from 'rxjs';
import { Product } from './product.model';
import { ProductsApiService } from './products.service';

interface ProductsLocalState {
  selectedId: number | null;
  filterCategory: string | null;
  categories: string[];
  searchQuery: string;
  total: number;
}

export const ProductsStore = signalStore(
  withDevtools('products'),
  withState<ProductsLocalState>({
    selectedId: null,
    filterCategory: null,
    categories: [],
    searchQuery: '',
    total: 0,
  }),
  withEntities<Product>(),
  withCallState(),
  withComputed((store) => ({
    selectedProduct: computed(() => {
      const id = store.selectedId();
      return id ? store.entities().find((e) => e.id === id) ?? null : null;
    }),
    filteredProducts: computed(() => {
      const cat = store.filterCategory();
      const entities = store.entities();
      return cat ? entities.filter((e) => e.category === cat) : entities;
    }),
    totalCount: computed(() => store.entities().length),
  })),
  withMethods((store) => {
    const productsService = inject(ProductsApiService);

    return {
      loadProducts: rxMethod<void>(
        pipe(
          tap(() => updateState(store, 'load products', setLoading())),
          switchMap(() =>
            productsService.getAll(30).pipe(
              tap({
                next: (response) =>
                  updateState(
                    store,
                    'load products success',
                    setAllEntities(response.products),
                    { total: response.total, ...setLoaded() }
                  ),
                error: (error) =>
                  updateState(
                    store,
                    'load products error',
                    setError(error?.message ?? 'Failed to load products')
                  ),
              })
            )
          )
        )
      ),

      searchProducts: rxMethod<string>(
        pipe(
          tap((q) => updateState(store, 'search products', { searchQuery: q, ...setLoading() })),
          switchMap((query) =>
            productsService.search(query).pipe(
              tap({
                next: (response) =>
                  updateState(
                    store,
                    'search products success',
                    setAllEntities(response.products),
                    { total: response.total, filterCategory: null, ...setLoaded() }
                  ),
                error: (error) =>
                  updateState(
                    store,
                    'search products error',
                    setError(error?.message ?? 'Search failed')
                  ),
              })
            )
          )
        )
      ),

      loadByCategory: rxMethod<string>(
        pipe(
          tap((cat) => updateState(store, 'load by category', { filterCategory: cat, ...setLoading() })),
          switchMap((category) =>
            productsService.getByCategory(category).pipe(
              tap({
                next: (response) =>
                  updateState(
                    store,
                    'load by category success',
                    setAllEntities(response.products),
                    { total: response.total, ...setLoaded() }
                  ),
                error: (error) =>
                  updateState(
                    store,
                    'load by category error',
                    setError(error?.message ?? 'Failed to load category')
                  ),
              })
            )
          )
        )
      ),

      loadCategories: rxMethod<void>(
        pipe(
          switchMap(() =>
            productsService.getCategories().pipe(
              tap({
                next: (categories) =>
                  updateState(store, 'load categories success', { categories }),
                error: () => { /* categories are non-critical */ },
              })
            )
          )
        )
      ),

      selectProduct(id: number | null): void {
        updateState(store, 'select product', { selectedId: id });
      },
    };
  }),
  withHooks({
    onInit(store) {
      store.loadProducts();
      store.loadCategories();
    },
  })
);
