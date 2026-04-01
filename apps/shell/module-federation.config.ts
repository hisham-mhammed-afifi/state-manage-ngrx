import { ModuleFederationConfig } from '@nx/module-federation';
import { createSharedConfig } from '../../tools/mf-shared';

const config: ModuleFederationConfig = {
  name: 'shell',
  remotes: [],
  shared: createSharedConfig,
};

export default config;
