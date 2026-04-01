import { ModuleFederationConfig } from '@nx/module-federation';
import { createSharedConfig } from '../../tools/mf-shared';

const config: ModuleFederationConfig = {
  name: 'orders',
  exposes: {
    './Routes': 'apps/orders/src/app/remote-entry/entry.routes.ts',
  },
  shared: createSharedConfig,
};

export default config;
