import eslint from '@eslint/js';
import vue from 'eslint-plugin-vue';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-unused-expressions': 'warn',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/prefer-namespace-keyword': 'off',
      'no-console': 'off',
      'no-case-declarations': 'warn',
      'no-fallthrough': 'warn',
      'no-loss-of-precision': 'warn',
      'no-undef': 'off',
      'no-useless-assignment': 'warn',
      'prefer-const': 'warn',
      'vue/multi-word-component-names': 'off',
    },
  },
);
