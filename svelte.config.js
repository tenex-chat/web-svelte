import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter({
			fallback: 'index.html'
		})
	},

	compilerOptions: {
		warningFilter: (warning) => {
			// Disable all a11y warnings
			return !warning.code?.startsWith('a11y_');
		}
	},

	onwarn: (warning, handler) => {
		// Disable all a11y warnings
		if (warning.code?.startsWith('a11y_')) {
			return;
		}
		handler(warning);
	}
};

export default config;
