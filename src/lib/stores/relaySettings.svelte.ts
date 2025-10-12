import { browser } from '$app/environment';
import ndk from '$lib/ndk.svelte';

const STORAGE_KEY = 'relay-settings';

class RelaySettingsStore {
	relays = $state<string[]>([]);

	constructor() {
		if (browser) {
			this.load();
		}
	}

	private load() {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				this.relays = JSON.parse(stored);
			} else {
				this.relays = Array.from(ndk.pool.relays.keys());
			}
		} catch (error) {
			console.error('Failed to load relay settings:', error);
			this.relays = Array.from(ndk.pool.relays.keys());
		}
	}

	private save() {
		if (!browser) return;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(this.relays));
		} catch (error) {
			console.error('Failed to save relay settings:', error);
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
		this.save();

		ndk.addExplicitRelay(normalizedUrl);
	}

	removeRelay(url: string) {
		this.relays = this.relays.filter((r) => r !== url);
		this.save();

		const relay = ndk.pool.relays.get(url);
		if (relay) {
			relay.disconnect();
			ndk.pool.relays.delete(url);
		}
	}

	getRelayStatus(url: string): 'connected' | 'connecting' | 'disconnected' {
		const relay = ndk.pool.relays.get(url);
		if (!relay) return 'disconnected';

		if (relay.connectivity.status === 1) return 'connected';
		if (relay.connectivity.status === 0) return 'connecting';
		return 'disconnected';
	}
}

export const relaySettingsStore = new RelaySettingsStore();
