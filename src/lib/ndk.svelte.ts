import NDKCacheSqliteWasm from '@nostr-dev-kit/cache-sqlite-wasm';
import { NDKSvelte } from '@nostr-dev-kit/svelte';
import { LocalStorage } from '@nostr-dev-kit/sessions';
import { browser } from '$app/environment';
import { registerEventClass } from '@nostr-dev-kit/ndk';
import { NDKProject } from '$lib/events/NDKProject';
import { NDKAgentDefinition } from '$lib/events/NDKAgentDefinition';
import { NDKProjectStatus } from '$lib/events/NDKProjectStatus';
import { NDKTask } from '$lib/events/NDKTask';
import { NDKMCPTool } from '$lib/events/NDKMCPTool';
import { NDKAgentLesson } from '$lib/events/NDKAgentLesson';

const DEFAULT_RELAYS = ['wss://tenex.chat'];

// Initialize SQLite WASM cache with worker mode (browser only)
const cacheAdapter = browser
	? new NDKCacheSqliteWasm({
			dbName: 'tenex-cache',
			useWorker: true,
			workerUrl: '/worker.js',
			wasmUrl: '/sql-wasm.wasm'
		})
	: undefined;

// Initialize signature verification worker (only in browser)
let sigVerifyWorker: Worker | undefined;

export const ndk = browser
	? new NDKSvelte({
			explicitRelayUrls: DEFAULT_RELAYS,
			autoConnectUserRelays: false,
			cacheAdapter,
			signatureVerificationWorker: sigVerifyWorker,
			initialValidationRatio: 1.0,
			lowestValidationRatio: 0.1,
			session: {
				storage: new LocalStorage(),
				autoSave: true,
				fetches: {
					follows: true,
					mutes: true,
					wallet: false,
					relayList: true
				}
			}
		})
	: (new NDKSvelte({ explicitRelayUrls: DEFAULT_RELAYS }) as any);

// Register custom event classes (only in browser)
if (browser) {
	registerEventClass(NDKProject);
	registerEventClass(NDKAgentDefinition);
	registerEventClass(NDKProjectStatus);
	registerEventClass(NDKTask);
	registerEventClass(NDKMCPTool);
	registerEventClass(NDKAgentLesson);
}

// Initialize the cache and connect
export const ndkReady = (async () => {
	if (!browser) return;

	try {
		// Initialize signature verification worker using official NDK worker
		const SigVerifyWorker = (await import('@nostr-dev-kit/ndk/workers/sig-verification?worker')).default;
		sigVerifyWorker = new SigVerifyWorker();
		ndk.signatureVerificationWorker = sigVerifyWorker;
		ndk.connect();
	} catch (error) {
		console.error('❌ Failed to initialize cache:', error);
	}
})();

export default ndk;
