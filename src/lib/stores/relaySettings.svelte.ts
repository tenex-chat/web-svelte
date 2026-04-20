import { browser } from '$app/environment';
import ndk from '$lib/ndk.svelte';
import { normalizeRelayUrl, NDKRelayStatus } from '@nostr-dev-kit/ndk';
import { storage } from '$lib/utils/storage.svelte';

class RelaySettingsStore {
	relays = $state<string[]>([]);

	constructor() {
		if (browser) {
			this.load();
		}
	}

	private load() {
		const stored = storage.get('relay-settings');
		if (stored) {
			this.relays = stored;
		} else {
			this.relays = Array.from(ndk.pool.relays.keys());
		}
	}

	addRelay(url: string) {
		const normalizedUrl = url.trim();

		if (!normalizedUrl.startsWith('wss://') && !normalizedUrl.startsWith('ws://')) {
			throw new Error('Relay URL must start with wss:// or ws://');
		}

		if (this.relays.includes(normalizedUrl)) {
			throw new Error('Relay already exists');
		}

		this.relays = [...this.relays, normalizedUrl];
		storage.set('relay-settings', this.relays);

		ndk.addExplicitRelay(normalizedUrl);
	}

	removeRelay(url: string) {
		this.relays = this.relays.filter((r) => r !== url);
		storage.set('relay-settings', this.relays);

		const normalized = normalizeRelayUrl(url);
		const relay = ndk.pool.relays.get(normalized);
		if (relay) {
			relay.disconnect();
			ndk.pool.relays.delete(normalized);
		}
	}

	getRelayStatus(url: string): 'connected' | 'connecting' | 'disconnected' {
		const normalized = normalizeRelayUrl(url);
		const relay = ndk.pool.relays.get(normalized);
		if (!relay) return 'disconnected';

		const status = relay.connectivity.status;
		if (
			status === NDKRelayStatus.CONNECTED ||
			status === NDKRelayStatus.AUTH_REQUESTED ||
			status === NDKRelayStatus.AUTHENTICATING ||
			status === NDKRelayStatus.AUTHENTICATED
		) {
			return 'connected';
		}
		if (status === NDKRelayStatus.CONNECTING || status === NDKRelayStatus.RECONNECTING) {
			return 'connecting';
		}
		return 'disconnected';
	}
}

export const relaySettingsStore = new RelaySettingsStore();
