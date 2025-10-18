import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	// Set COOP/COEP headers for SharedArrayBuffer support (required for VAD/WASM)
	response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');

	// Allow workers, WASM files, and static assets to be loaded with COEP
	const url = event.url.pathname;
	if (url.endsWith('.js') || url.endsWith('.mjs') || url.endsWith('.wasm') || url.startsWith('/static/')) {
		response.headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
	}

	return response;
};
