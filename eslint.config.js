import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import svelteParser from 'svelte-eslint-parser';
import globals from 'globals';

// Same rule set as the drakriddarna repo (ESLint 10, typescript-eslint 8):
// type-aware linting over .ts files with prettier enforced, plus the
// reverse-boundary import restriction — game-logic modules may not import
// the UI kit, canvas chrome stays on the render side (src/game/scene/,
// Svelte components), so logic stays headless-testable.
export default tseslint.config(
  {
    ignores: [
      'build/**',
      // Flat config does not ignore dot-directories by default.
      '.svelte-kit/**',
    ],
  },
  {
    files: ['**/*.ts'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      prettierRecommended,
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.svelte'],
      },
    },
    rules: {
      '@typescript-eslint/no-var-requires': 'error',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-inferrable-types': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      'prettier/prettier': 'error',
      '@typescript-eslint/no-use-before-define': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      'arrow-body-style': ['warn', 'as-needed'],
      'no-dupe-else-if': 'warn',
      '@typescript-eslint/no-base-to-string': [
        'warn',
        { ignoredTypeNames: ['literal'] },
      ],
      'no-console': 'error',
      quotes: [2, 'single', { avoidEscape: true }],
      '@typescript-eslint/no-unsafe-enum-comparison': 'off',
    },
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: tseslint.parser,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // Canvas-mock test objects are `as unknown as CanvasRenderingContext2D`,
  // so method references like `expect(ctx.arc).toHaveBeenCalled()` carry the
  // DOM method type and trip unbound-method even though the underlying
  // values are bound vi.fn() mocks. The rule has no value in tests.
  {
    files: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  // Reverse boundary: game-logic modules must not import the UI kit, so
  // headless tests never pull in canvas chrome code. Only components in
  // src/components/ and UI-facing adapters cross that boundary.
  {
    files: [
      'src/game/engine/**/*.ts',
      'src/game/world/**/*.ts',
      'src/game/saves/**/*.ts',
      'src/game/audio/**/*.ts',
      'src/game/rng.ts',
      'src/game/game.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: ['@hoard-engine/uikit', '@hoard-engine/uikit/**'],
        },
      ],
    },
  },
);
