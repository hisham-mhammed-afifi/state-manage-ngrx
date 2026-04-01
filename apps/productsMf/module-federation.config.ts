import { ModuleFederationConfig } from '@nx/module-federation';
import { createSharedConfig } from '../../tools/mf-shared';

const config: ModuleFederationConfig = {
  name: 'productsMf',
  exposes: {
    './Routes': 'apps/productsMf/src/app/remote-entry/entry.routes.ts',
  },
  shared: createSharedConfig,
};

export default config;
