import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [
            '^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$',
            '^.*/tools/mf-shared$',
          ],
          depConstraints: [
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
            {
              sourceTag: 'scope:shop',
              onlyDependOnLibsWithTags: ['scope:shop', 'scope:shared'],
            },
            {
              sourceTag: 'scope:api',
              onlyDependOnLibsWithTags: ['scope:api', 'scope:shared'],
            },
            {
              sourceTag: 'scope:shell',
              onlyDependOnLibsWithTags: ['scope:shell', 'scope:shared'],
            },
            {
              sourceTag: 'scope:orders',
              onlyDependOnLibsWithTags: ['scope:orders', 'scope:shared'],
            },
            {
              sourceTag: 'scope:products',
              onlyDependOnLibsWithTags: ['scope:products', 'scope:shared'],
            },
            {
              sourceTag: 'scope:cart',
              onlyDependOnLibsWithTags: ['scope:cart', 'scope:shared'],
            },
            {
              sourceTag: 'type:data',
              onlyDependOnLibsWithTags: ['type:data'],
            },
            {
              sourceTag: 'type:state-core',
              onlyDependOnLibsWithTags: ['type:state-core', 'type:data'],
            },
            {
              sourceTag: 'type:state-feature',
              onlyDependOnLibsWithTags: [
                'type:state-core',
                'type:state-feature',
                'type:data',
              ],
            },
            {
              sourceTag: 'type:feature',
              onlyDependOnLibsWithTags: [
                'type:feature',
                'type:state-feature',
                'type:state-core',
                'type:data',
                'type:ui',
              ],
            },
            {
              sourceTag: 'type:ui',
              onlyDependOnLibsWithTags: ['type:ui', 'type:data'],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {},
  },
];
