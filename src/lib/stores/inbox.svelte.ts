import { ndk } from '$lib/ndk.svelte';
import type { NDKEvent, NDKSubscription, NDKFilter } from '@nostr-dev-kit/ndk';
import { browser } from '$app/environment';

/**
 * Event kinds to include in the inbox
 */
export const INBOX_EVENT_KINDS = [
	1, // Regular text notes/mentions
	1111, // Generic replies (including agent responses)
	30023, // Long-form content mentions
	7 // Reactions that p-tag the user
];

/**
 * Groups events by their E tag and deduplicates them
 * For events with the same E tag, only the most recent one is kept
 */
function deduplicateEventsByETag(events: NDKEvent[]): NDKEvent[] {
	const eventsByETag = new Map<string | null, NDKEvent[]>();

	events.forEach((event) => {
		const eTag = event.tags.find((tag) => tag[0] === 'E')?.[1] || null;
		const existing = eventsByETag.get(eTag) || [];
		existing.push(event);
		eventsByETag.set(eTag, existing);
	});

	const deduplicatedEvents: NDKEvent[] = [];

	eventsByETag.forEach((groupedEvents, eTag) => {
		if (eTag === null) {
			deduplicatedEvents.push(...groupedEvents);
		} else {
			const mostRecent = groupedEvents.reduce((latest, current) => {
				const latestTime = latest.created_at || 0;
				const currentTime = current.created_at || 0;
				return currentTime > latestTime ? current : latest;
			});
			deduplicatedEvents.push(mostRecent);
		}
	});

	return deduplicatedEvents;
}

/**
 * Sorts events by creation time (newest first)
 */
function sortEventsByTime(events: NDKEvent[], ascending = false): NDKEvent[] {
	return [...events].sort((a, b) => {
		const timeA = a.created_at || 0;
		const timeB = b.created_at || 0;
		return ascending ? timeA - timeB : timeB - timeA;
	});
}

/**
 * Helper to get persisted last visit timestamp
 */
function getPersistedLastVisit(): number {
	if (!browser) return Math.floor(Date.now() / 1000);

	const stored = localStorage.getItem('last-inbox-visit');
	if (stored) {
		return parseInt(stored, 10);
	}
	return Math.floor(Date.now() / 1000);
}

/**
 * Helper to persist last visit timestamp
 */
function persistLastVisit(timestamp: number): void {
	if (!browser) return;
	localStorage.setItem('last-inbox-visit', timestamp.toString());
}

class InboxStore {
	events = $state<NDKEvent[]>([]);
	lastVisit = $state<number>(getPersistedLastVisit());
	isLoading = $state<boolean>(false);
	unreadCount = $state<number>(0);
	private subscription: NDKSubscription | null = null;
	private eventMap = new Map<string, NDKEvent>();

	init() {
		if (!browser) return;

		// Clean up any existing subscription
		this.cleanup();

		const currentUser = ndk.$sessions?.currentUser;
		if (!currentUser?.pubkey) return;

		this.isLoading = true;

		// Create filter for events that p-tag the current user
		const filter: NDKFilter = {
			'#p': [currentUser.pubkey],
			kinds: INBOX_EVENT_KINDS,
			// Get events from the last 7 days by default
			since: Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60
		};

		// Create subscription using NDK directly (NDKSvelte extends NDK)
		this.subscription = ndk.subscribe(filter, {
			closeOnEose: false,
			groupable: false,
			subId: 'inbox-events-store'
		});

		// Handle incoming events
		this.subscription?.on('event', (event: NDKEvent) => {
			// Add to map (automatically handles updates/duplicates)
			this.eventMap.set(event.id, event);

			// Convert map to array, deduplicate, and sort
			const allEvents = Array.from(this.eventMap.values());
			const deduplicated = deduplicateEventsByETag(allEvents);
			const sorted = sortEventsByTime(deduplicated);

			// Calculate unread count
			const unreadCount = sorted.filter(
				(e) => e.created_at && e.created_at > this.lastVisit
			).length;

			// Update state
			this.events = sorted;
			this.unreadCount = unreadCount;
			this.isLoading = false;
		});

		this.subscription?.on('eose', () => {
			this.isLoading = false;
		});
	}

	markAllRead() {
		const now = Math.floor(Date.now() / 1000);
		persistLastVisit(now);

		// Recalculate unread count with new timestamp
		const unreadCount = this.events.filter((e) => e.created_at && e.created_at > now).length;

		this.lastVisit = now;
		this.unreadCount = unreadCount;
	}

	updateLastVisit(timestamp: number) {
		persistLastVisit(timestamp);

		// Recalculate unread count with new timestamp
		const unreadCount = this.events.filter(
			(e) => e.created_at && e.created_at > timestamp
		).length;

		this.lastVisit = timestamp;
		this.unreadCount = unreadCount;
	}

	isEventUnread(event: NDKEvent): boolean {
		return event.created_at ? event.created_at > this.lastVisit : false;
	}

	cleanup() {
		if (this.subscription) {
			this.subscription.stop();
			this.subscription = null;
		}
		this.eventMap.clear();
		this.events = [];
		this.unreadCount = 0;
	}

	// Alias for consistency with other stores
	destroy() {
		this.cleanup();
	}
}

export const inboxStore = new InboxStore();
