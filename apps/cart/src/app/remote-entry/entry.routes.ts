import { Route } from '@angular/router';
import { RemoteEntry } from './entry';
import { CartStore } from '@org/feature-cart-state';

export const remoteRoutes: Route[] = [
  {
    path: '',
    providers: [CartStore],
    component: RemoteEntry,
  },
];
