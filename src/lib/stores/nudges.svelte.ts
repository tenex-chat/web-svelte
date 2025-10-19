import { ndk } from '$lib/ndk.svelte';
import { NDKKind } from '$lib/kinds';
import type { NDKEvent } from '@nostr-dev-kit/ndk';

class NudgeStore {
	nudges = $state<NDKEvent[]>([]);
	savedNudges = $state<string[]>([]);
	loading = $state(false);

	constructor() {
		// Load saved nudges from localStorage
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem('saved_nudges');
			if (saved) {
				try {
					this.savedNudges = JSON.parse(saved);
				} catch {
					this.savedNudges = [];
				}
			}
		}
	}

	async loadNudges() {
		this.loading = true;
		try {
			const nudgeEvents = await ndk.fetchEvents({
				kinds: [NDKKind.AgentNudge]
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
			localStorage.setItem('saved_nudges', JSON.stringify(this.savedNudges));
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
