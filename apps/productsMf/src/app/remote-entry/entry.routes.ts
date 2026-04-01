import { Route } from '@angular/router';
import { RemoteEntry } from './entry';
import { ProductsStore } from '@org/feature-products-state';

export const remoteRoutes: Route[] = [
  {
    path: '',
    providers: [ProductsStore],
    component: RemoteEntry,
  },
];
