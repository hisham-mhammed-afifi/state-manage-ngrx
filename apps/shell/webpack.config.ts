import { withModuleFederation } from '@nx/module-federation/angular';
import { Configuration } from 'webpack';
import config from './module-federation.config';

export default withModuleFederation(config, { dts: false }).then((mfConfig) => {
  return (baseConfig: Configuration): Configuration => {
    const result = mfConfig(baseConfig);
    return {
      ...result,
      output: {
        ...result.output,
        publicPath: '/',
      },
    };
  };
});
