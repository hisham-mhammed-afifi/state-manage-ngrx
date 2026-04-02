import { Route } from '@angular/router';
import { loadRemote } from '@module-federation/enhanced/runtime';
import { LoginComponent } from './components/login/login.component';
import { HomeComponent } from './components/home/home.component';
import { authGuard } from './guards/auth.guard';

export const appRoutes: Route[] = [
  {
    path: 'login',
    component: LoginComponent,
  },
  {
    path: 'productsMf',
    loadChildren: () =>
      loadRemote<typeof import('productsMf/Routes')>('productsMf/Routes').then(
        (m) => m!.remoteRoutes
      ),
  },
  {
    path: 'orders',
    canActivate: [authGuard],
    loadChildren: () =>
      loadRemote<typeof import('orders/Routes')>('orders/Routes').then(
        (m) => m!.remoteRoutes
      ),
  },
  {
    path: 'cart',
    canActivate: [authGuard],
    loadChildren: () =>
      loadRemote<typeof import('cart/Routes')>('cart/Routes').then(
        (m) => m!.remoteRoutes
      ),
  },
  {
    path: 'guide',
    redirectTo: 'guide/01',
    pathMatch: 'full',
  },
  {
    path: 'guide/:chapter',
    loadComponent: () =>
      import('./components/guide/guide.component').then(
        (m) => m.GuideComponent
      ),
  },
  {
    path: '',
    component: HomeComponent,
  },
  {
    path: '**',
    redirectTo: '',
  },
];
