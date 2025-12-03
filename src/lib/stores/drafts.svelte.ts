import { browser } from '$app/environment';
import { TIMING } from '$lib/constants';
import { SvelteMap } from 'svelte/reactivity';

const STORAGE_KEY = 'message-drafts';
const TIMESTAMP_KEY = 'draft-timestamps';

interface DraftTimestamps {
	[key: string]: number;
}

class DraftStore {
	drafts = $state(new SvelteMap<string, string>());

	constructor() {
		if (browser) {
			this.loadFromStorage();
			// Defer cleanup to not block initial rendering
			setTimeout(() => this.cleanup(), 2000);
		}
	}

	private loadFromStorage() {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			try {
				const obj = JSON.parse(stored);
				this.drafts = new SvelteMap(Object.entries(obj));
			} catch {
				this.drafts = new SvelteMap();
			}
		}
	}

	private saveToStorage() {
		if (!browser) return;

		const obj = Object.fromEntries(this.drafts);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
	}

	private updateTimestamp(conversationId: string) {
		if (!browser) return;

		const timestamps: DraftTimestamps = JSON.parse(
			localStorage.getItem(TIMESTAMP_KEY) || '{}'
		);
		timestamps[conversationId] = Date.now();
		localStorage.setItem(TIMESTAMP_KEY, JSON.stringify(timestamps));
	}

	private cleanup() {
		if (!browser) return;

		const timestamps: DraftTimestamps = JSON.parse(
			localStorage.getItem(TIMESTAMP_KEY) || '{}'
		);
		const now = Date.now();
		const cleanupDuration = TIMING.DRAFT_CLEANUP_DURATION;

		// Remove old drafts
		for (const [conversationId, timestamp] of Object.entries(timestamps)) {
			if (now - timestamp > cleanupDuration) {
				this.drafts.delete(conversationId);
				delete timestamps[conversationId];
			}
		}

		this.saveToStorage();
		localStorage.setItem(TIMESTAMP_KEY, JSON.stringify(timestamps));
	}

	getDraft(conversationId: string | undefined): string {
		if (!conversationId) return '';
		return this.drafts.get(conversationId) || '';
	}

	saveDraft(conversationId: string | undefined, content: string) {
		if (!conversationId) return;

		// Skip if unchanged
		const existing = this.drafts.get(conversationId);
		if (existing === content) return;

		if (!content.trim()) {
			// Remove empty drafts
			this.drafts.delete(conversationId);
		} else {
			this.drafts.set(conversationId, content);
			this.updateTimestamp(conversationId);
		}

		this.saveToStorage();
	}

	clearDraft(conversationId: string | undefined) {
		if (!conversationId) return;

		this.drafts.delete(conversationId);
		this.saveToStorage();

		// Also remove timestamp
		if (browser) {
			const timestamps: DraftTimestamps = JSON.parse(
				localStorage.getItem(TIMESTAMP_KEY) || '{}'
			);
			delete timestamps[conversationId];
			localStorage.setItem(TIMESTAMP_KEY, JSON.stringify(timestamps));
		}
	}
}

export const draftStore = new DraftStore();
