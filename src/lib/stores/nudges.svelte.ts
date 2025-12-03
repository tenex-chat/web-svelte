import { ndk } from '$lib/ndk.svelte';
import { NDKKind } from '$lib/kinds';
import type { NDKEvent } from '@nostr-dev-kit/ndk';
import { storage } from '$lib/utils/storage.svelte';

class NudgeStore {
	nudges = $state<NDKEvent[]>([]);
	savedNudges = $state<string[]>([]);
	loading = $state(false);

	constructor() {
		// Load saved nudges from storage
		if (typeof window !== 'undefined') {
			this.savedNudges = storage.get('saved_nudges') ?? [];
		}
	}

	async loadNudges() {
		this.loading = true;
		try {
			const nudgeEvents = await ndk.fetchEvents({
				kinds: [NDKKind.AgentNudge as number]
			});
			this.nudges = Array.from(nudgeEvents).sort((a, b) => {
				const aTime = a.created_at || 0;
				const bTime = b.created_at || 0;
				return bTime - aTime;
			});
		} catch (error) {
			console.error('Failed to fetch nudges:', error);
		} finally {
			this.loading = false;
		}
	}

	toggleSaved(nudgeId: string) {
		if (this.savedNudges.includes(nudgeId)) {
			this.savedNudges = this.savedNudges.filter(id => id !== nudgeId);
		} else {
			this.savedNudges = [...this.savedNudges, nudgeId];
		}
		if (typeof window !== 'undefined') {
			storage.set('saved_nudges', this.savedNudges);
		}
	}

	getDisplayNudges(userPubkey?: string): NDKEvent[] {
		if (!userPubkey) return this.nudges;
		return this.nudges.filter((nudge) => {
			return nudge.pubkey === userPubkey || this.savedNudges.includes(nudge.id);
		});
	}
}

export const nudgeStore = new NudgeStore();
