import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { resolve } from 'path';

export default defineConfig({
	main: {
		plugins: [externalizeDepsPlugin()],
		build: {
			outDir: 'dist-electron/main',
			rollupOptions: {
				input: resolve(__dirname, 'electron/main.ts'),
				output: {
					entryFileNames: 'index.js'
				}
			}
		}
	},
	preload: {
		plugins: [externalizeDepsPlugin()],
		build: {
			outDir: 'dist-electron/preload',
			rollupOptions: {
				input: resolve(__dirname, 'electron/preload.ts'),
				output: {
					format: 'cjs',
					entryFileNames: 'preload.cjs'
				}
			}
		}
	},
	renderer: {
		plugins: [sveltekit()],
		root: '.',
		server: {
			port: 5173
		},
		build: {
			outDir: 'build',
			rollupOptions: {
				input: resolve(__dirname, 'build/index.html')
			}
		}
	}
});
