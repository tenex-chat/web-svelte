import NDKCacheSqliteWasm from '@nostr-dev-kit/cache-sqlite-wasm';
import { createNDK } from '@nostr-dev-kit/svelte';
import { LocalStorage } from '@nostr-dev-kit/sessions';
import { browser } from '$app/environment';
import { registerEventClass } from '@nostr-dev-kit/ndk';
import { NDKProject } from '$lib/events/NDKProject';
import { NDKAgentDefinition } from '$lib/events/NDKAgentDefinition';
import { NDKAgentDefinitionPack } from '$lib/events/NDKAgentDefinitionPack';
import { NDKProjectStatus } from '$lib/events/NDKProjectStatus';
import { NDKTask } from '$lib/events/NDKTask';
import { NDKMCPTool } from '$lib/events/NDKMCPTool';
import { NDKAgentLesson } from '$lib/events/NDKAgentLesson';
import { perfProfiler } from '$lib/perf-profiler';

const DEFAULT_RELAYS = ['wss://tenex.chat'];

// Initialize SQLite WASM cache (browser only)
const cacheAdapter = browser
	? new NDKCacheSqliteWasm({
			dbName: 'tenex-cache',
			workerUrl: '/worker.js'
		})
	: undefined;

// Initialize signature verification worker (only in browser)
let sigVerifyWorker: Worker | undefined;

export const ndk = createNDK({
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

// Register custom event classes (only in browser)
if (browser) {
	registerEventClass(NDKProject);
	registerEventClass(NDKAgentDefinition);
	registerEventClass(NDKAgentDefinitionPack);
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

		// Add performance tracking for NDK events
		let eventCount = 0;
		let lastLogTime = Date.now();
		ndk.on('event', () => {
			eventCount++;
			perfProfiler.trackSubscription('event');
			const now = Date.now();
			if (now - lastLogTime > 5000) {
				console.log(`[PERF NDK] Received ${eventCount} events in last 5s`);
				eventCount = 0;
				lastLogTime = now;
			}
		});

		ndk.on('subscription:start', (sub: any) => {
			perfProfiler.trackSubscription('start');
			console.log(`[PERF NDK] Subscription started:`, sub.filters?.slice(0, 2));
		});

		ndk.on('subscription:close', () => {
			perfProfiler.trackSubscription('stop');
		});

		ndk.connect();
	} catch (error) {
		console.error('❌ Failed to initialize cache:', error);
	}
})();

export default ndk;
