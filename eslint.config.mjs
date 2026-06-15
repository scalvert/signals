import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'node_modules',
      'coverage',
      'state',
      '.next',
      '.claude',
      'beacon-scaffold',
      '**/*.mjs',
    ],
  },
  ...tseslint.configs.recommended,
)
