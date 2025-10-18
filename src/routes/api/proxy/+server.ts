import { error, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url, fetch }) => {
	const imageUrl = url.searchParams.get('url');

	if (!imageUrl) {
		return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	try {
		console.log('[Proxy] Fetching:', imageUrl);
		const response = await fetch(imageUrl);

		if (!response.ok) {
			console.error('[Proxy] Fetch failed:', response.status, response.statusText);
			return new Response(JSON.stringify({ error: `Fetch failed: ${response.statusText}` }), {
				status: response.status,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const contentType = response.headers.get('content-type') || 'image/svg+xml';
		const arrayBuffer = await response.arrayBuffer();

		console.log('[Proxy] Success:', imageUrl, contentType);

		return new Response(arrayBuffer, {
			headers: {
				'Content-Type': contentType,
				'Cache-Control': 'public, max-age=86400',
				'Cross-Origin-Resource-Policy': 'cross-origin'
			}
		});
	} catch (e) {
		console.error('[Proxy] Error:', e);
		return new Response(JSON.stringify({ error: `Proxy error: ${e instanceof Error ? e.message : String(e)}` }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
