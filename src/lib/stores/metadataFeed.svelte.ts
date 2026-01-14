import { browser } from '$app/environment';
import { ndk } from '$lib/ndk.svelte';
import { NDKKind } from '$lib/kinds';
import type { NDKEvent, NDKSubscription } from '@nostr-dev-kit/ndk';

export interface MetadataFeedItem {
	conversationId: string;
	title: string | undefined;
	summary: string | undefined;
	statusLabel: string | undefined;
	statusCurrentActivity: string | undefined;
	tags: string[];
	latestTimestamp: number;
	latestEvent: NDKEvent;
}

/**
 * Store for the metadata column feed.
 * Subscribes to kind:513 events and maintains a sorted list of conversations
 * by their latest metadata update time.
 */
class MetadataFeedStore {
	items = $state<MetadataFeedItem[]>([]);
	private initialized = false;
	private subscription: NDKSubscription | undefined;
	private conversationMap = new Map<string, MetadataFeedItem>();

	/**
	 * Initialize the store - MUST be called from a component context
	 */
	init() {
		if (this.initialized || !browser) return;
		this.initialized = true;

		$effect(() => {
			if (this.subscription) {
				this.subscription.stop();
			}

			this.subscription = ndk.subscribe(
				[{ kinds: [NDKKind.TenexConversationMetadata as number] }],
				{
					closeOnEose: false,
					subId: 'metadata-feed'
				},
				{
					onEvents: (events: NDKEvent[]) => {
						for (const event of events) {
							this.processEvent(event);
						}
						this.updateItems();
					},
					onEvent: (event: NDKEvent) => {
						this.processEvent(event);
						this.updateItems();
					}
				}
			);
		});
	}

	private processEvent(event: NDKEvent): void {
		const conversationId = event.tags.find((tag) => tag[0] === 'e')?.[1];
		if (!conversationId) return;

		const timestamp = event.created_at ?? 0;
		const existing = this.conversationMap.get(conversationId);

		// Extract metadata from tags
		const title = event.tags.find((tag) => tag[0] === 'title')?.[1];
		const summary = event.tags.find((tag) => tag[0] === 'summary')?.[1];
		const statusLabel = event.tags.find((tag) => tag[0] === 'status-label')?.[1];
		const statusCurrentActivity = event.tags.find((tag) => tag[0] === 'status-current-activity')?.[1];
		const tags = event.tags.filter((tag) => tag[0] === 't').map((tag) => tag[1]);

		if (!existing || timestamp > existing.latestTimestamp) {
			// Update with newer event - merge fields
			this.conversationMap.set(conversationId, {
				conversationId,
				title: title ?? existing?.title,
				summary: summary ?? existing?.summary,
				statusLabel: statusLabel ?? existing?.statusLabel,
				statusCurrentActivity: statusCurrentActivity ?? existing?.statusCurrentActivity,
				tags: tags.length > 0 ? tags : (existing?.tags ?? []),
				latestTimestamp: timestamp,
				latestEvent: event
			});
		} else if (existing) {
			// Older event - but may have fields we don't have yet
			if (!existing.title && title) existing.title = title;
			if (!existing.summary && summary) existing.summary = summary;
			if (!existing.statusLabel && statusLabel) existing.statusLabel = statusLabel;
			if (!existing.statusCurrentActivity && statusCurrentActivity) existing.statusCurrentActivity = statusCurrentActivity;
			if (existing.tags.length === 0 && tags.length > 0) existing.tags = tags;
		}
	}

	private updateItems(): void {
		// Sort by latest timestamp descending (newest first)
		this.items = Array.from(this.conversationMap.values())
			.sort((a, b) => b.latestTimestamp - a.latestTimestamp);
	}

	cleanup() {
		if (this.subscription) {
			this.subscription.stop();
			this.subscription = undefined;
		}
		this.conversationMap.clear();
		this.items = [];
		this.initialized = false;
	}
}

export const metadataFeedStore = new MetadataFeedStore();
