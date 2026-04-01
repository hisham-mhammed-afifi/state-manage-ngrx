import { ModuleFederationConfig } from '@nx/module-federation';
import { createSharedConfig } from '../../tools/mf-shared';

const config: ModuleFederationConfig = {
  name: 'cart',
  exposes: {
    './Routes': 'apps/cart/src/app/remote-entry/entry.routes.ts',
  },
  shared: createSharedConfig,
};

export default config;
