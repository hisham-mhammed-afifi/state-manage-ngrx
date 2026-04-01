import { Route } from '@angular/router';
import { RemoteEntry } from './entry';
import { OrdersStore } from '@org/feature-orders-state';

export const remoteRoutes: Route[] = [
  {
    path: '',
    providers: [OrdersStore],
    component: RemoteEntry,
  },
];
