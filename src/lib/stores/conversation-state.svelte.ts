import { SvelteMap } from 'svelte/reactivity';
import { NDKEvent, type NDKSubscription, type NDKFilter } from '@nostr-dev-kit/ndk';
import type { NDKSvelte } from '@nostr-dev-kit/svelte';
import type { Message, ThreadViewMode } from '$lib/utils/messageUtils';
import { uiSettingsStore } from './uiSettings.svelte';

interface ConversationOptions {
	viewMode?: ThreadViewMode;
	directRepliesOnly?: boolean;
	debug?: boolean;
}

export class ConversationState {
	private messages = $state(new SvelteMap<string, Message>());
	private rootEvent: NDKEvent | null;
	private viewMode: ThreadViewMode;
	private directRepliesOnly: boolean;
	private debug: boolean;
	private subscription: NDKSubscription | null = null;
	private isDestroyed = false;

	displayMessages = $derived.by(() => {
		const allMessages: Message[] = [...this.messages.values()];

		// Sort by timestamp (with tag priority for same timestamp)
		allMessages.sort((a, b) => {
			const timeA = a.event.created_at ?? 0;
			const timeB = b.event.created_at ?? 0;

			if (timeA !== timeB) return timeA - timeB;

			// Secondary sort for same timestamp
			const aHasReasoning = a.event.hasTag('reasoning');
			const bHasReasoning = b.event.hasTag('reasoning');
			const aHasTool = a.event.hasTag('tool');
			const bHasTool = b.event.hasTag('tool');

			if (aHasReasoning && !bHasReasoning) return -1;
			if (!aHasReasoning && bHasReasoning) return 1;
			if (aHasTool && !bHasTool) return -1;
			if (!aHasTool && bHasTool) return 1;

			return 0;
		});

		// Filter events based on user preferences
		let filtered = allMessages;

		if (!uiSettingsStore.settings.showReasoningEvents) {
			filtered = filtered.filter(msg => !msg.event.hasTag('reasoning'));
		}

		if (!uiSettingsStore.settings.showToolEvents) {
			filtered = filtered.filter(msg => !msg.event.hasTag('tool'));
		}

		return filtered;
	});

	// Map of replies indexed by parent event ID for O(1) lookups
	repliesByParent = $derived.by(() => {
		const map = new Map<string, Message[]>();

		for (const message of this.displayMessages) {
			const eTags = message.event.getMatchingTags('e');
			for (const tag of eTags) {
				const parentId = tag[1];
				if (parentId) {
					const replies = map.get(parentId) || [];
					replies.push(message);
					map.set(parentId, replies);
				}
			}
		}

		return map;
	});

	constructor(
		private ndk: NDKSvelte,
		rootEvent: NDKEvent | null,
		options: ConversationOptions = {}
	) {
		this.rootEvent = rootEvent;
		this.viewMode = options.viewMode ?? 'threaded';
		this.directRepliesOnly = options.directRepliesOnly ?? false;
		this.debug = options.debug ?? false;
	}

	private log(message: string, data?: unknown): void {
		if (this.debug) {
			console.log(`[ConversationState] ${message}`, data ?? '');
		}
	}

	start(): void {
		if (!this.rootEvent || this.isDestroyed) return;

		// Add root event to messages (unless directRepliesOnly mode)
		if (!this.directRepliesOnly && !this.messages.has(this.rootEvent.id)) {
			this.messages.set(this.rootEvent.id, {
				id: this.rootEvent.id,
				event: this.rootEvent
			});
		}

		const filters = this.buildFilters();
		this.log('Starting subscription with filters', filters);

		this.subscription = this.ndk.subscribe(filters, {
			closeOnEose: false,
			onEvents: (events: NDKEvent[]) => {
				for (const e of events) this.processEvent(e);
			},
			onEvent: (event: NDKEvent) => this.processEvent(event)
		});
	}

	private buildFilters(): NDKFilter[] {
		if (!this.rootEvent) return [];

		if (this.directRepliesOnly) {
			return [{
				kinds: [1],
				'#e': [this.rootEvent.id],
				limit: 100
			}];
		}

		return [{
			kinds: [1],
			'#e': [this.rootEvent.id]
		}];
	}

	private processEvent(event: NDKEvent): void {
		// Skip operations events
		if (event.kind === 24133 || event.kind === 24134) return;

		// Apply view mode filtering
		if (this.viewMode === 'threaded' && !this.belongsToConversation(event)) return;

		this.messages.set(event.id, { id: event.id, event });
	}

	private belongsToConversation(event: NDKEvent): boolean {
		if (!this.rootEvent) return true;
		if (event.id === this.rootEvent.id) return true;

		const eTags = event.getMatchingTags('e');
		return eTags.some((tag) => tag[1] === this.rootEvent!.id);
	}

	destroy(): void {
		this.isDestroyed = true;
		this.subscription?.stop();
		this.subscription = null;
		this.messages.clear();
	}
}
