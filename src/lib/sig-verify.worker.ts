import { verifyEvent } from 'nostr-tools/pure';

self.addEventListener('message', (event) => {
	const { id, event: nostrEvent } = event.data;

	try {
		const isValid = verifyEvent(nostrEvent);
		self.postMessage({ id, valid: isValid });
	} catch (error) {
		self.postMessage({ id, valid: false, error: error instanceof Error ? error.message : 'Unknown error' });
	}
});

export {};
