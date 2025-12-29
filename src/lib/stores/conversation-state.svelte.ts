import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { NDKEvent, type NDKSubscription, type NDKFilter } from '@nostr-dev-kit/ndk';
import type { NDKSvelte } from '@nostr-dev-kit/svelte';
import { NDKKind } from '$lib/kinds';
import type { Message, ThreadViewMode } from '$lib/utils/messageUtils';
import { conversationMetadataStore } from './conversationMetadata.svelte';
import { processConversationMetadataEvent } from '$lib/utils/conversationMetadataProcessor';
import { performanceMetrics, type ConversationStateMetrics } from './performance-metrics.svelte';
import { uiSettingsStore } from './uiSettings.svelte';

interface ConversationOptions {
	viewMode?: ThreadViewMode;
	currentUserPubkey?: string;
	directRepliesOnly?: boolean;
	debug?: boolean;
	maxReconnectAttempts?: number;
	reconnectDelay?: number;
}

export class ConversationState {
	// Reactive maps using SvelteMap for proper Svelte 5 reactivity
	private messages = $state(new SvelteMap<string, Message>());
	private metadataEvents = $state(new SvelteMap<string, NDKEvent>());

	// Options
	private rootEvent: NDKEvent | null;
	private viewMode: ThreadViewMode;
	private currentUserPubkey: string | undefined;
	private directRepliesOnly: boolean;
	private debug: boolean;
	private maxReconnectAttempts: number;
	private reconnectDelay: number;

	// NDK subscription
	private subscription: NDKSubscription | null = null;

	// Reconnection state
	private reconnectAttempts = 0;
	private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
	private isDestroyed = false;

	// Performance metrics
	private conversationId: string;
	private metrics = {
		eventsProcessed: 0,
		displayMessagesComputations: 0,
		displayMessagesComputeTime: 0,
		lastComputeTime: 0,
		slowComputationCount: 0
	};

	// Reactive display messages for UI
	displayMessages = $derived.by(() => {
		const startTime = performance.now();
		this.metrics.displayMessagesComputations++;
		const allMessages: Message[] = [];
		const rootEventId = this.rootEvent?.id;

		// Add messages from the map, filtering out nested replies
		// A message is a nested reply if it has an 'e' tag pointing to a non-root event
		for (const message of this.messages.values()) {
			// Check if this message replies to a non-root event
			const eTags = message.event.getMatchingTags('e');
			const isNestedReply = eTags.some(tag => {
				const parentId = tag[1];
				// If it points to something other than root AND that something exists in our messages, it's nested
				return parentId && parentId !== rootEventId && this.messages.has(parentId);
			});

			// Only include in flat list if NOT a nested reply
			if (!isNestedReply) {
				allMessages.push(message);
			}
		}

		// Sort by timestamp (with tag priority for same timestamp)
		allMessages.sort((a, b) => {
			const timeA = a.event.created_at ?? 0;
			const timeB = b.event.created_at ?? 0;

			if (timeA !== timeB) {
				return timeA - timeB;
			}

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

		// Track computation time
		const computeTime = performance.now() - startTime;
		this.metrics.displayMessagesComputeTime += computeTime;
		this.metrics.lastComputeTime = computeTime;

		if (computeTime > 50) {
			this.metrics.slowComputationCount++;
		}

		// Update global metrics if enabled
		if (performanceMetrics.isEnabled) {
			performanceMetrics.updateConversationStateMetrics(this.conversationId, {
				...this.metrics,
				avgComputeTime: this.metrics.displayMessagesComputeTime / this.metrics.displayMessagesComputations
			});
		}

		// Filter events based on user preferences
		let filteredMessages = allMessages;

		if (!uiSettingsStore.settings.showReasoningEvents) {
			filteredMessages = filteredMessages.filter(msg => !msg.event.hasTag('reasoning'));
		}

		if (!uiSettingsStore.settings.showToolEvents) {
			filteredMessages = filteredMessages.filter(msg => !msg.event.hasTag('tool'));
		}

		return filteredMessages;
	});

	// Combined messages and metadata events for rendering
	displayEventsWithMetadata = $derived.by(() => {
		const events: Array<{ type: 'message' | 'metadata'; data: Message | NDKEvent }> = [];

		// Add all messages
		for (const message of this.displayMessages) {
			events.push({ type: 'message', data: message });
		}

		// Add all metadata events
		for (const metadataEvent of this.metadataEvents.values()) {
			events.push({ type: 'metadata', data: metadataEvent });
		}

		// Sort by timestamp
		events.sort((a, b) => {
			const timeA = a.type === 'message'
				? (a.data as Message).event.created_at ?? 0
				: (a.data as NDKEvent).created_at ?? 0;
			const timeB = b.type === 'message'
				? (b.data as Message).event.created_at ?? 0
				: (b.data as NDKEvent).created_at ?? 0;
			return timeA - timeB;
		});

		return events;
	});

	// Map of replies indexed by parent event ID for O(1) lookups
	// Uses ALL messages (not just displayMessages) so nested replies can be found
	repliesByParent = $derived.by(() => {
		const map = new Map<string, Message[]>();

		for (const message of this.messages.values()) {
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

		// Sort replies by timestamp within each parent
		for (const [parentId, replies] of map.entries()) {
			replies.sort((a, b) => (a.event.created_at ?? 0) - (b.event.created_at ?? 0));
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
		this.currentUserPubkey = options.currentUserPubkey;
		this.directRepliesOnly = options.directRepliesOnly ?? false;
		this.debug = options.debug ?? false;
		this.maxReconnectAttempts = options.maxReconnectAttempts ?? 5;
		this.reconnectDelay = options.reconnectDelay ?? 1000;
		this.conversationId = rootEvent?.id || `conversation-${crypto.randomUUID()}`;
	}

	private log(message: string, data?: any): void {
		if (this.debug) {
			console.log(`[ConversationState] ${message}`, data || '');
		}
	}

	start(): void {
		if (!this.rootEvent) {
			this.log('No root event, skipping subscription');
			return;
		}

		if (this.isDestroyed) {
			this.log('ConversationState is destroyed, cannot start');
			return;
		}

		// Add the root event itself to messages ONLY if NOT directRepliesOnly
		if (!this.directRepliesOnly && !this.messages.has(this.rootEvent.id)) {
			this.messages.set(this.rootEvent.id, {
				id: this.rootEvent.id,
				event: this.rootEvent
			});
			this.log('Added root event to messages', { eventId: this.rootEvent.id });
		}

		const onEvent = (event: NDKEvent) => {
			try {
				this.processEvent(event);
			} catch (error) {
				console.error('[ConversationState] Error processing event:', error, event);
			}
		}

		try {
			const filters = this.buildFilters();
			this.log('Starting subscription with filters', filters);

			this.subscription = this.ndk.subscribe(filters, {
				closeOnEose: false,
				onEvents: (events: NDKEvent[]) => {
					for (const e of events) {
						if (e.kind === NDKKind.GenericReply)
							onEvent(e);
					}
				},
				onEvent,
				onClose: () => {
					this.log('Subscription closed');
					if (!this.isDestroyed) {
						this.handleSubscriptionError();
					}
				}
			});

			this.reconnectAttempts = 0;
		} catch (error) {
			console.error('[ConversationState] Failed to start subscription:', error);
			this.handleSubscriptionError();
		}
	}

	private handleSubscriptionError(): void {
		if (this.isDestroyed) return;

		if (this.subscription) {
			try {
				this.subscription.stop();
			} catch (e) {
				// Ignore cleanup errors
			}
			this.subscription = null;
		}

		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			console.error('[ConversationState] Max reconnection attempts reached');
			return;
		}

		const delay = Math.min(
			this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
			30000
		);

		this.reconnectAttempts++;
		this.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
		}

		this.reconnectTimeout = setTimeout(() => {
			if (!this.isDestroyed) {
				this.log('Attempting to reconnect...');
				this.start();
			}
		}, delay);
	}

	private buildFilters(): NDKFilter[] {
		if (!this.rootEvent) return [];

		const filters: NDKFilter[] = [];

		if (this.directRepliesOnly) {
			filters.push({
				kinds: [NDKKind.GenericReply],
				'#e': [this.rootEvent.id],
				limit: 100
			});
		} else {
			filters.push(
				{ kinds: [11, NDKKind.GenericReply, NDKKind.TenexConversationMetadata as number], ...this.rootEvent.filter() },
				{ kinds: [11, NDKKind.GenericReply, NDKKind.TenexConversationMetadata as number], ...this.rootEvent.nip22Filter() }
			);
		}

		return filters;
	}

	private processEvent(event: NDKEvent): void {
		this.metrics.eventsProcessed++;

		// Skip operations events
		if (event.kind === 24133 || event.kind === 24134) {
			this.log('Skipping operations event', { kind: event.kind });
			return;
		}

		// Apply view mode filtering
		if (this.viewMode === 'threaded' && !this.belongsToConversation(event)) {
			this.log('Event filtered out - not part of conversation', { eventId: event.id });
			return;
		}

		const pubkey = event.pubkey;
		this.log(`Processing event kind ${event.kind} from ${pubkey}`, { eventId: event.id });

		switch (event.kind) {
			case NDKKind.GenericReply: // 1111 - Final message
				this.handleFinalMessage(event, pubkey);
				break;

			case NDKKind.TenexConversationMetadata: // 513 - Conversation metadata
				this.handleMetadataEvent(event);
				break;

			case 11: // Thread/conversation root
				this.handleRegularMessage(event);
				break;

			default:
				this.handleRegularMessage(event);
				this.log(`Handling event kind ${event.kind} as regular message`);
				break;
		}
	}

	/**
	 * Handle final message (kind 1111)
	 */
	private handleFinalMessage(event: NDKEvent, _pubkey: string): void {
		const message: Message = { id: event.id, event };
		this.log('Added final message', { eventId: event.id });

		// Add to messages map
		this.messages.set(event.id, message);
	}

	private handleRegularMessage(event: NDKEvent): void {
		this.messages.set(event.id, { id: event.id, event });
	}

	private handleMetadataEvent(event: NDKEvent): void {
		const conversationId = event.tags.find((tag) => tag[0] === 'e')?.[1];
		if (!conversationId) {
			this.log('Metadata event missing conversation ID', { eventId: event.id });
			return;
		}

		this.metadataEvents.set(event.id, event);

		const currentMetadata = conversationMetadataStore.getMetadata(conversationId);
		const result = processConversationMetadataEvent(event, currentMetadata);

		if (result.success) {
			if (result.title || result.summary) {
				conversationMetadataStore.setMetadata(result.conversationId, {
					title: result.title,
					summary: result.summary
				});
				this.log('Updated conversation metadata', {
					conversationId: result.conversationId,
					hasTitle: !!result.title,
					hasSummary: !!result.summary
				});
			}
		} else {
			console.error(`Failed to process kind 513 event: ${result.error}`, {
				eventId: result.eventId
			});
		}
	}

	private belongsToConversation(event: NDKEvent): boolean {
		if (!this.rootEvent) return true;
		if (event.id === this.rootEvent.id) return true;

		const ETags = event.getMatchingTags('E');
		if (ETags.some((tag) => tag[1] === this.rootEvent!.id)) {
			return true;
		}

		const eTags = event.getMatchingTags('e');
		return eTags.some((tag) => tag[1] === this.rootEvent!.id);
	}

	destroy(): void {
		this.log('Destroying ConversationState');
		this.isDestroyed = true;

		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}

		if (this.subscription) {
			try {
				this.subscription.stop();
			} catch (error) {
				this.log('Error stopping subscription during destroy', error);
			}
			this.subscription = null;
		}

		this.messages.clear();

		this.log('ConversationState destroyed successfully');
	}

	getMetrics(): ConversationStateMetrics {
		return {
			...this.metrics,
			avgComputeTime: this.metrics.displayMessagesComputations > 0
				? this.metrics.displayMessagesComputeTime / this.metrics.displayMessagesComputations
				: 0
		};
	}
}
