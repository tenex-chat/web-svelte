import { browser } from '$app/environment';
import { TIMING } from '$lib/constants';
import { storage } from '$lib/utils/storage.svelte';
import { SvelteMap } from 'svelte/reactivity';

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
		const stored = storage.get('message-drafts');
		if (stored) {
			try {
				this.drafts = new SvelteMap(Object.entries(stored));
			} catch {
				this.drafts = new SvelteMap();
			}
		}
	}

	private cleanup() {
		if (!browser) return;

		const timestamps = storage.get('draft-timestamps') ?? {};
		const now = Date.now();
		const cleanupDuration = TIMING.DRAFT_CLEANUP_DURATION;

		// Remove old drafts
		for (const [conversationId, timestamp] of Object.entries(timestamps)) {
			if (now - timestamp > cleanupDuration) {
				this.drafts.delete(conversationId);
				storage.clearDraft(conversationId);
			}
		}
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
			storage.clearDraft(conversationId);
		} else {
			this.drafts.set(conversationId, content);
			storage.setDraft(conversationId, content);
		}
	}

	clearDraft(conversationId: string | undefined) {
		if (!conversationId) return;

		this.drafts.delete(conversationId);
		storage.clearDraft(conversationId);
	}
}

export const draftStore = new DraftStore();
