import { ndk } from '$lib/ndk.svelte';
import type { NDKEvent, NDKSubscription, NDKFilter } from '@nostr-dev-kit/ndk';
import { browser } from '$app/environment';
import { isAskEvent } from '$lib/utils/askTags';
import { storage } from '$lib/utils/storage.svelte';

/**
 * Event kinds to include in the inbox subscription.
 * Events are further filtered to only show "ask" events.
 */
export const INBOX_EVENT_KINDS = [
	1, // Regular text notes/mentions
];

/**
 * Groups events by their thread root and deduplicates them.
 * Root events are identified by having NO lowercase "e" tags.
 * For events in the same thread, only the most recent one is kept.
 */
function deduplicateEventsByThread(events: NDKEvent[]): NDKEvent[] {
	const eventsByThread = new Map<string, NDKEvent[]>();

	events.forEach((event) => {
		// Check if this event has any lowercase "e" tags (making it a reply)
		const eTag = event.tags.find((tag) => tag[0] === 'e')?.[1];

		if (!eTag) {
			// No "e" tag means this IS a root event - use its own ID as the thread key
			const existing = eventsByThread.get(event.id) || [];
			existing.push(event);
			eventsByThread.set(event.id, existing);
		} else {
			// Has "e" tag - this is a reply, group by the referenced event ID
			const existing = eventsByThread.get(eTag) || [];
			existing.push(event);
			eventsByThread.set(eTag, existing);
		}
	});

	const deduplicatedEvents: NDKEvent[] = [];

	eventsByThread.forEach((groupedEvents, threadId) => {
		// Find root events in this group (events with no "e" tags)
		const rootEvents = groupedEvents.filter((e) => !e.tags.some((t) => t[0] === 'e'));

		if (rootEvents.length > 0) {
			// If there are root events, include all of them
			deduplicatedEvents.push(...rootEvents);
		} else {
			// No root event in group - include only the most recent reply
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
	const stored = storage.get('last-inbox-visit');
	return stored ?? Math.floor(Date.now() / 1000);
}

/**
 * Helper to persist last visit timestamp
 */
function persistLastVisit(timestamp: number): void {
	if (!browser) return;
	storage.set('last-inbox-visit', timestamp);
}

class InboxStore {
	events = $state<NDKEvent[]>([]);
	lastVisit = $state<number>(getPersistedLastVisit());
	private viewedEvents = $derived.by(() => storage.getViewedAskEvents());
	viewedEventIds = $derived.by(() => new Set(Object.keys(this.viewedEvents)));
	unreadCount = $derived.by(() => this.events.filter((event) => this.isEventUnread(event)).length);
	threadUnreadStatus = $derived.by(
		() => new Map(this.events.map((event) => [event.id, this.isEventUnread(event)]))
	);
	private subscription: NDKSubscription | null = null;
	private eventMap = new Map<string, NDKEvent>();

	private updateState() {
		const allEvents = Array.from(this.eventMap.values());
		const deduplicated = deduplicateEventsByThread(allEvents);
		const sorted = sortEventsByTime(deduplicated);
		this.events = sorted;
	}

	init() {
		if (!browser) return;

		// Clean up any existing subscription
		this.cleanup();

		if (!ndk.$currentPubkey) return;

		// Create filter for ask events that p-tag the current user
		const filter: NDKFilter = {
			"#p": [ndk.$currentPubkey],
			"#t": ["ask"],
			kinds: INBOX_EVENT_KINDS,
			// Get events from the last 7 days by default
			since: Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60,
		};

		// Create subscription using NDK directly (NDKSvelte extends NDK)
		this.subscription = ndk.subscribe(filter, {
			closeOnEose: false,
			groupable: false,
			subId: 'inbox',
			onEvents: (events: NDKEvent[]) => {
				// Bulk add all events to map, filtering to only include ask events
				for (const event of events) {
					// Only include events that have the "ask" tag
					if (isAskEvent(event)) {
						this.eventMap.set(event.id, event);
					}
				}
				this.updateState();
			},
			onEvent: (event: NDKEvent) => {
				// Only include events that have the "ask" tag
				if (isAskEvent(event)) {
					this.eventMap.set(event.id, event);
					this.updateState();
				}
			}
		});
	}

	markAllRead() {
		const now = Math.floor(Date.now() / 1000);
		persistLastVisit(now);
		this.lastVisit = now;
	}

	updateLastVisit(timestamp: number) {
		persistLastVisit(timestamp);
		this.lastVisit = timestamp;
	}

	isEventUnread(event: NDKEvent): boolean {
		// If the event has been individually viewed, it's not unread
		if (this.viewedEventIds.has(event.id)) {
			return false;
		}
		// Otherwise fall back to the lastVisit timestamp
		return event.created_at ? event.created_at > this.lastVisit : false;
	}

	/**
	 * Mark a specific event as viewed
	 */
	markEventViewed(eventId: string): void {
		storage.markAskEventViewed(eventId);
	}

	cleanup() {
		if (this.subscription) {
			this.subscription.stop();
			this.subscription = null;
		}
		this.eventMap.clear();
		this.events = [];
	}

	// Alias for consistency with other stores
	destroy() {
		this.cleanup();
	}
}

export const inboxStore = new InboxStore();
