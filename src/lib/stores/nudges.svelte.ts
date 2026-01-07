import { ndk } from '$lib/ndk.svelte';
import { NDKKind } from '$lib/kinds';
import type { NDKEvent, NDKSubscription } from '@nostr-dev-kit/ndk';
import { storage } from '$lib/utils/storage.svelte';
import { browser } from '$app/environment';

class NudgeStore {
	nudges = $state<NDKEvent[]>([]);
	savedNudges = $state<string[]>([]);
	private subscription: NDKSubscription | null = null;
	private eventMap = new Map<string, NDKEvent>();
	private initialized = false;

	constructor() {
		// Load saved nudges from storage
		if (typeof window !== 'undefined') {
			this.savedNudges = storage.get('saved_nudges') ?? [];
		}
	}

	private updateState() {
		const allEvents = Array.from(this.eventMap.values());
		// Sort by created_at, newest first
		this.nudges = allEvents.sort((a, b) => {
			const aTime = a.created_at || 0;
			const bTime = b.created_at || 0;
			return bTime - aTime;
		});
	}

	init() {
		if (!browser || this.initialized) return;
		this.initialized = true;

		// Create persistent subscription for nudge events
		this.subscription = ndk.subscribe(
			{ kinds: [NDKKind.AgentNudge as number] },
			{
				closeOnEose: false,
				groupable: false,
				subId: 'nudges-store',
				onEvents: (events: NDKEvent[]) => {
					for (const event of events) {
						this.eventMap.set(event.id, event);
					}
					this.updateState();
				},
				onEvent: (event: NDKEvent) => {
					this.eventMap.set(event.id, event);
					this.updateState();
				}
			}
		);
	}

	destroy() {
		if (this.subscription) {
			this.subscription.stop();
			this.subscription = null;
		}
		this.eventMap.clear();
		this.nudges = [];
		this.initialized = false;
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
