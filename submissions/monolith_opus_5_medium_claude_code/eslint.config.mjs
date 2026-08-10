export default [
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
    },
    rules: {
      'no-unused-vars': ['error', { args: 'none' }],
      'no-undef': 'off',
      eqeqeq: ['error', 'smart'],
    },
  },
];
