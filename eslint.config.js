import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

export default ts.config(
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			}
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig
			}
		},
		rules: {
			// Disable navigation resolution check since app has no base path
			'svelte/no-navigation-without-resolve': 'off',
			// Disable @html warning since we use DOMPurify for sanitization
			'svelte/no-at-html-tags': 'off'
		}
	},
	{
		ignores: [
			'.svelte-kit/**',
			'build/**',
			'dist/**',
			'dist-electron/**',
			'out/**',
			'node_modules/**',
			'**/*.cjs',
			'tailwind.config.js'
		]
	}
);
