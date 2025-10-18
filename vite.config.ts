import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// Plugin to inject CommonJS shim for exports
function injectCJSShim(): Plugin {
	return {
		name: 'inject-cjs-shim',
		transformIndexHtml(html) {
			return html.replace(
				'<head>',
				`<head>
				<script>
					// CommonJS compatibility shim
					if (typeof exports === 'undefined') {
						window.exports = {};
					}
					if (typeof module === 'undefined') {
						window.module = { exports: {} };
					}
				</script>`
			);
		}
	};
}

// Plugin to add CORP headers for COEP compatibility
function addCORPHeaders(): Plugin {
	return {
		name: 'add-corp-headers',
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
				next();
			});
		}
	};
}

// Plugin to copy VAD WASM files to static folder
function copyVadWasmFiles(): Plugin {
	return {
		name: 'copy-vad-wasm',
		configResolved() {
			const filesToCopy = [
				// Model files
				{ src: 'node_modules/@ricky0123/vad-web/dist/silero_vad_legacy.onnx', dest: 'static' },
				{ src: 'node_modules/@ricky0123/vad-web/dist/silero_vad_v5.onnx', dest: 'static/vad' },
				// Worklet
				{ src: 'node_modules/@ricky0123/vad-web/dist/vad.worklet.bundle.min.js', dest: 'static/vad' },
				// WASM files
				{ src: 'node_modules/onnxruntime-web/dist/ort-wasm-simd.wasm', dest: 'static/vad' },
				{ src: 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm', dest: 'static/vad' },
				{ src: 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm', dest: 'static/vad' },
				{ src: 'node_modules/onnxruntime-web/dist/ort-wasm.wasm', dest: 'static/vad' },
				// MJS files for dynamic imports
				{ src: 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs', dest: 'static/vad' },
				{ src: 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs', dest: 'static/vad' },
				{ src: 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.mjs', dest: 'static/vad' }
			];

			for (const { src, dest } of filesToCopy) {
				try {
					if (!existsSync(dest)) {
						mkdirSync(dest, { recursive: true });
					}

					if (existsSync(src)) {
						const fileName = src.split('/').pop();
						const destPath = join(dest, fileName!);
						copyFileSync(src, destPath);
						console.log(`✓ Copied ${fileName} to ${dest}/`);
					} else {
						console.warn(`⚠ File not found: ${src}`);
					}
				} catch (err) {
					console.warn(`Could not copy ${src}:`, err);
				}
			}
		}
	};
}

export default defineConfig({
	plugins: [
		addCORPHeaders(),
		injectCJSShim(),
		copyVadWasmFiles(),
		sveltekit()
	],
	server: {
		port: 5000,
		fs: {
			allow: ['..']
		}
	},
	define: {
		'global': 'globalThis',
	},
	optimizeDeps: {
		include: ['@ricky0123/vad-web'],
		exclude: ['onnxruntime-web'],
		esbuildOptions: {
			target: 'esnext',
			define: {
				global: 'globalThis'
			}
		}
	},
	build: {
		target: 'esnext',
		commonjsOptions: {
			include: [/node_modules/],
			transformMixedEsModules: true
		},
		rollupOptions: {
			output: {
				manualChunks: {
					'vad-web': ['@ricky0123/vad-web']
				}
			}
		}
	},
	worker: {
		format: 'es'
	},
	assetsInclude: ['**/*.onnx', '**/*.wasm']
});
