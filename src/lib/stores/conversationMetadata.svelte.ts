import { browser } from '$app/environment';
import { ndk } from '$lib/ndk.svelte';
import { NDKKind } from '$lib/kinds';
import { processConversationMetadataEvent, type MetadataField } from '$lib/utils/conversationMetadataProcessor';
import type { NDKEvent, NDKSubscription } from '@nostr-dev-kit/ndk';

export interface ConversationMetadataResult {
	id: string;
	title: string | undefined;
	summary: string | undefined;
	hasTitle: boolean;
	hasSummary: boolean;
}

/**
 * Per-conversation reactive entry.
 * Each conversation gets its own $state properties so updates only trigger
 * re-renders for components reading that specific conversation.
 */
class ConversationMetadataEntry {
	id: string;
	title = $state<MetadataField | undefined>(undefined);
	summary = $state<MetadataField | undefined>(undefined);

	constructor(id: string) {
		this.id = id;
	}
}

/**
 * Centralized store for conversation metadata (kind:513)
 * Subscribes once to all metadata events and provides per-conversation reactive accessors.
 */
class ConversationMetadataStore {
	private entries = new Map<string, ConversationMetadataEntry>();
	private initialized = false;

	/**
	 * Initialize the store - MUST be called from a component context
	 * (e.g. in +layout.svelte)
	 */
	init() {
		if (this.initialized || !browser) return;
		this.initialized = true;

		let subscription: NDKSubscription | undefined;

		$effect(() => {
			if (subscription) {
				subscription.stop();
			}

			subscription = ndk.subscribe(
				[{ kinds: [NDKKind.TenexConversationMetadata as number] }],
				{
					closeOnEose: false,
					subId: 'conversation-metadata'
				},
				{
					onEvents: (events: NDKEvent[]) => {
						for (const event of events) {
							this.processEvent(event);
						}
					},
					onEvent: (event: NDKEvent) => {
						this.processEvent(event);
					}
				}
			);
		});
	}

	private processEvent(event: NDKEvent): void {
		const conversationId = event.tags.find((tag) => tag[0] === 'e')?.[1];
		if (!conversationId) return;

		const entry = this.getOrCreateEntry(conversationId);
		const currentMetadata = entry.title || entry.summary
			? { id: conversationId, title: entry.title, summary: entry.summary }
			: undefined;

		const result = processConversationMetadataEvent(event, currentMetadata);

		if (result.success) {
			if (result.title) entry.title = result.title;
			if (result.summary) entry.summary = result.summary;
		}
	}

	private getOrCreateEntry(id: string): ConversationMetadataEntry {
		let entry = this.entries.get(id);
		if (!entry) {
			entry = new ConversationMetadataEntry(id);
			this.entries.set(id, entry);
		}
		return entry;
	}

	setMetadata(
		conversationId: string,
		data: {
			title?: MetadataField;
			summary?: MetadataField;
		}
	): void {
		const entry = this.getOrCreateEntry(conversationId);
		if (data.title) entry.title = data.title;
		if (data.summary) entry.summary = data.summary;
	}

	getMetadata(conversationId: string): { id: string; title?: MetadataField; summary?: MetadataField } | undefined {
		const entry = this.entries.get(conversationId);
		if (!entry) return undefined;
		return {
			id: conversationId,
			title: entry.title,
			summary: entry.summary
		};
	}

	getConversationData(conversationId: string | undefined): ConversationMetadataResult {
		if (!conversationId) {
			return {
				id: '',
				title: undefined,
				summary: undefined,
				hasTitle: false,
				hasSummary: false
			};
		}

		const entry = this.getOrCreateEntry(conversationId);

		return {
			id: conversationId,
			title: entry.title?.value,
			summary: entry.summary?.value,
			hasTitle: !!entry.title,
			hasSummary: !!entry.summary
		};
	}

	clearMetadata(): void {
		this.entries.clear();
	}
}

export const conversationMetadataStore = new ConversationMetadataStore();
