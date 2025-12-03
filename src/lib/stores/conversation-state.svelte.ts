import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { NDKEvent, type NDKSubscription, type NDKFilter } from '@nostr-dev-kit/ndk';
import type { NDKSvelte } from '@nostr-dev-kit/svelte';
import { NDKKind } from '$lib/kinds';
import { DeltaContentAccumulator } from '$lib/utils/DeltaContentAccumulator';
import type { Message, ThreadViewMode } from '$lib/utils/messageUtils';
import { conversationMetadataStore } from './conversationMetadata.svelte';
import { processConversationMetadataEvent } from '$lib/utils/conversationMetadataProcessor';
import { performanceMetrics, type ConversationStateMetrics } from './performance-metrics.svelte';
import { uiSettingsStore } from './uiSettings.svelte';

interface StreamingSession {
	syntheticId: string;
	accumulator: DeltaContentAccumulator;
	latestEvent: NDKEvent;
	reconstructedContent: string;
}

interface ConversationOptions {
	viewMode?: ThreadViewMode;
	currentUserPubkey?: string;
	directRepliesOnly?: boolean;
	debug?: boolean; // Enable debug logging
	maxReconnectAttempts?: number; // Max reconnection attempts (default: 5)
	reconnectDelay?: number; // Initial reconnect delay in ms (default: 1000)
}

export class ConversationState {
	// Reactive maps using SvelteMap for proper Svelte 5 reactivity
	private messages = $state(new SvelteMap<string, Message>());
	private streamingSessions = $state(new SvelteMap<string, StreamingSession>());
	private typingIndicators = $state(new SvelteMap<string, NDKEvent>());
	private metadataEvents = $state(new SvelteMap<string, NDKEvent>());

	// Options
	private rootEvent: NDKEvent | null;
	private viewMode: ThreadViewMode;
	private currentUserPubkey?: string;
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
		streamingEvents: 0,
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

		// Add all final messages from the map
		for (const message of this.messages.values()) {
			allMessages.push(message);
		}

		// Debug: Check for duplicate messages
		const messageIds = new Map<string, number>();
		allMessages.forEach(m => {
			const count = messageIds.get(m.id) || 0;
			messageIds.set(m.id, count + 1);
		});
		const duplicates = Array.from(messageIds.entries()).filter(([id, count]) => count > 1);
		if (duplicates.length > 0) {
			console.warn('[ConversationState.displayMessages] DUPLICATE MESSAGES:', {
				rootEventId: this.rootEvent?.id,
				duplicates,
				allMessages: allMessages.map(m => ({
					id: m.id,
					eventId: m.event.id,
					kind: m.event.kind,
					content: m.event.content?.substring(0, 30)
				}))
			});
		}

		// Add active streaming sessions as synthetic messages
		for (const session of this.streamingSessions.values()) {
			// Create synthetic event with accumulated content
			const syntheticEvent = new NDKEvent(session.latestEvent.ndk);
			syntheticEvent.kind = session.latestEvent.kind;
			syntheticEvent.pubkey = session.latestEvent.pubkey;
			syntheticEvent.created_at = session.latestEvent.created_at;
			syntheticEvent.tags = session.latestEvent.tags;
			syntheticEvent.content = session.reconstructedContent;
			syntheticEvent.id = session.latestEvent.id;
			syntheticEvent.sig = session.latestEvent.sig;

			allMessages.push({
				id: session.syntheticId,
				event: syntheticEvent
			});
		}

		// Add active typing indicators
		for (const [pubkey, typingEvent] of this.typingIndicators) {
			allMessages.push({
				id: `typing-${pubkey}`, // OK to use pubkey here as only one typing indicator per pubkey
				event: typingEvent
			});
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

		// Filter reasoning events based on user preference
		if (!uiSettingsStore.settings.showReasoningEvents) {
			return allMessages.filter(msg => !msg.event.hasTag('reasoning'));
		}

		return allMessages;
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

	/**
	 * Log debug messages if debug mode is enabled
	 */
	private log(message: string, data?: any): void {
		if (this.debug) {
			console.log(`[ConversationState] ${message}`, data || '');
		}
	}

	/**
	 * Start the subscription and begin processing events
	 */
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
		// When directRepliesOnly=true (used by ThreadedMessage), we only want replies, not the root itself
		// This prevents the message from appearing as its own reply, which caused infinite recursion
		if (!this.directRepliesOnly && !this.messages.has(this.rootEvent.id)) {
			this.messages.set(this.rootEvent.id, {
				id: this.rootEvent.id,
				event: this.rootEvent
			});
			this.log('Added root event to messages', { eventId: this.rootEvent.id });
		}

		try {
			const filters = this.buildFilters();
			this.log('Starting subscription with filters', filters);

			// Use event-driven subscription with onEvent callback
			this.subscription = this.ndk.subscribe(filters, {
				closeOnEose: false
			});

			// Process each event as it arrives (O(1) per event)
			this.subscription.on('event', (event: NDKEvent) => {
				try {
					this.processEvent(event);
				} catch (error) {
					console.error('[ConversationState] Error processing event:', error, event);
				}
			});

			// Handle subscription close
			this.subscription.on('close', () => {
				this.log('Subscription closed');
				if (!this.isDestroyed) {
					this.handleSubscriptionError();
				}
			});

			// Start the subscription
			this.subscription.start();
			this.log('Subscription started successfully');

			// Reset reconnection attempts on successful start
			this.reconnectAttempts = 0;
		} catch (error) {
			console.error('[ConversationState] Failed to start subscription:', error);
			this.handleSubscriptionError();
		}
	}

	/**
	 * Handle subscription errors with exponential backoff reconnection
	 */
	private handleSubscriptionError(): void {
		if (this.isDestroyed) return;

		// Clean up existing subscription
		if (this.subscription) {
			try {
				this.subscription.stop();
			} catch (e) {
				// Ignore cleanup errors
			}
			this.subscription = null;
		}

		// Check if we should attempt reconnection
		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			console.error('[ConversationState] Max reconnection attempts reached');
			return;
		}

		// Calculate delay with exponential backoff
		const delay = Math.min(
			this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
			30000 // Max 30 seconds
		);

		this.reconnectAttempts++;
		this.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

		// Clear any existing timeout
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
		}

		// Schedule reconnection
		this.reconnectTimeout = setTimeout(() => {
			if (!this.isDestroyed) {
				this.log('Attempting to reconnect...');
				this.start();
			}
		}, delay);
	}

	/**
	 * Build NDK filters based on conversation type
	 */
	private buildFilters(): NDKFilter[] {
		if (!this.rootEvent) return [];

		const filters: NDKFilter[] = [];

		// Streaming kinds
		const streamingKinds: number[] = [
			NDKKind.TenexAgentTypingStart,
			NDKKind.TenexAgentTypingStop,
			NDKKind.TenexStreamingResponse
		];

		if (this.directRepliesOnly) {
			// Direct replies only (for threaded view)
			filters.push(
				{
					kinds: [NDKKind.GenericReply],
					'#e': [this.rootEvent.id],
					limit: 100
				},
				{
					kinds: streamingKinds,
					'#e': [this.rootEvent.id],
					limit: 100
				}
			);
		} else {
			// Regular conversation filters
			filters.push(
				{ kinds: [11, NDKKind.GenericReply, NDKKind.TenexConversationMetadata as number], ...this.rootEvent.filter() },
				{ kinds: [11, NDKKind.GenericReply, NDKKind.TenexConversationMetadata as number], ...this.rootEvent.nip22Filter() },
				{ kinds: streamingKinds, limit: 100, ...this.rootEvent.nip22Filter() }
			);
		}

		return filters;
	}

	/**
	 * Process a single event - O(1) complexity
	 */
	private processEvent(event: NDKEvent): void {
		// Track event processing
		this.metrics.eventsProcessed++;

		// Skip operations events
		if (event.kind === 24133 || event.kind === 24134) {
			this.log('Skipping operations event', { kind: event.kind });
			return;
		}

		// Apply view mode filtering
		if (this.viewMode === 'threaded' && !this.isDirectReplyToRoot(event)) {
			this.log('Event filtered out by threaded view mode', { eventId: event.id });
			return;
		}

		const pubkey = event.pubkey;
		this.log(`Processing event kind ${event.kind} from ${pubkey}`, { eventId: event.id });

		// Handle different event types with O(1) map operations
		switch (event.kind) {
			case NDKKind.GenericReply: // 1111 - Final message
				this.handleFinalMessage(event, pubkey);
				break;

			case NDKKind.TenexStreamingResponse: // 21111 - Streaming delta
				this.handleStreamingEvent(event, pubkey);
				break;

			case NDKKind.TenexAgentTypingStart: // 21081 - Typing start
				this.handleTypingStart(event, pubkey);
				break;

			case NDKKind.TenexAgentTypingStop: // 21082 - Typing stop
				this.handleTypingStop(pubkey);
				break;

			case NDKKind.TenexConversationMetadata: // 513 - Conversation metadata
				this.handleMetadataEvent(event);
				break;

			case 11: // Thread/conversation root
				this.handleRegularMessage(event);
				break;

			default:
				// All other message types
				this.handleRegularMessage(event);
				this.log(`Handling event kind ${event.kind} as regular message`);
				break;
		}
	}

	/**
	 * Handle final message (kind 1111)
	 */
	private handleFinalMessage(event: NDKEvent, pubkey: string): void {
		const message: Message = { id: event.id, event };
		this.log('Added final message', { eventId: event.id, pubkey });

		// Add to messages map (O(1))
		this.messages.set(event.id, message);

		// Delay clearing streaming session for 1000ms to ignore late-arriving chunks
		// This prevents late 21111 chunks from creating duplicate messages after finalization
		if (this.streamingSessions.has(pubkey)) {
			setTimeout(() => {
				this.streamingSessions.delete(pubkey);
				this.log('Cleared streaming session for pubkey (delayed)', { pubkey });
			}, 1000);
		}

		// Clear any typing indicator for this pubkey immediately (O(1))
		if (this.typingIndicators.has(pubkey)) {
			this.typingIndicators.delete(pubkey);
			this.log('Cleared typing indicator for pubkey', { pubkey });
		}
	}

	/**
	 * Handle streaming event (kind 21111)
	 */
	private handleStreamingEvent(event: NDKEvent, pubkey: string): void {
		// Track streaming events
		this.metrics.streamingEvents++;

		// Check if we already have a finalized message from this pubkey with same created_at
		// This catches late-arriving streaming chunks for already-finalized messages
		for (const message of this.messages.values()) {
			if (message.event.pubkey === pubkey &&
				message.event.kind === NDKKind.GenericReply &&
				message.event.created_at === event.created_at) {
				this.log('Ignoring late streaming chunk, finalized message exists', {
					streamingId: event.id.substring(0, 8),
					finalizedId: message.event.id.substring(0, 8),
					pubkey: pubkey.substring(0, 8),
					created_at: event.created_at
				});
				return;
			}
		}

		let session = this.streamingSessions.get(pubkey);

		if (!session) {
			// Create new streaming session with unique ID
			const syntheticId = `streaming-${crypto.randomUUID()}`;
			const accumulator = new DeltaContentAccumulator(syntheticId);
			const reconstructedContent = accumulator.addEvent(event);

			session = {
				syntheticId,
				accumulator,
				latestEvent: event,
				reconstructedContent
			};

			this.streamingSessions.set(pubkey, session);
			this.log('Created new streaming session', { pubkey, syntheticId });
		} else {
			// Update existing session
			session.reconstructedContent = session.accumulator.addEvent(event);
			session.latestEvent = event;
			this.log('Updated streaming session', {
				pubkey,
				syntheticId: session.syntheticId,
				contentLength: session.reconstructedContent.length
			});
		}
	}

	/**
	 * Handle typing start event (kind 21081)
	 */
	private handleTypingStart(event: NDKEvent, pubkey: string): void {
		// Clear any streaming session when typing starts
		if (this.streamingSessions.has(pubkey)) {
			this.streamingSessions.delete(pubkey);
		}

		// Set typing indicator
		this.typingIndicators.set(pubkey, event);
	}

	/**
	 * Handle typing stop event (kind 21082)
	 */
	private handleTypingStop(pubkey: string): void {
		// Remove typing indicator
		if (this.typingIndicators.has(pubkey)) {
			this.typingIndicators.delete(pubkey);
		}
	}

	/**
	 * Handle regular message events
	 */
	private handleRegularMessage(event: NDKEvent): void {
		this.messages.set(event.id, { id: event.id, event });
	}

	/**
	 * Handle conversation metadata event (kind 513)
	 */
	private handleMetadataEvent(event: NDKEvent): void {
		const conversationId = event.tags.find((tag) => tag[0] === 'e')?.[1];
		if (!conversationId) {
			this.log('Metadata event missing conversation ID', { eventId: event.id });
			return;
		}

		// Store the metadata event for rendering as a system message
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

	/**
	 * Check if event is a direct reply to root
	 */
	private isDirectReplyToRoot(event: NDKEvent): boolean {
		if (!this.rootEvent) return true;
		if (event.id === this.rootEvent.id) return true;

		const eTags = event.getMatchingTags('e');
		return eTags.some((tag) => tag[1] === this.rootEvent!.id);
	}

	/**
	 * Clean up and destroy the conversation state
	 */
	destroy(): void {
		this.log('Destroying ConversationState');
		this.isDestroyed = true;

		// Clear reconnection timeout
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}

		// Stop subscription
		if (this.subscription) {
			try {
				this.subscription.stop();
			} catch (error) {
				this.log('Error stopping subscription during destroy', error);
			}
			this.subscription = null;
		}

		// Clear all maps
		this.messages.clear();
		this.streamingSessions.clear();
		this.typingIndicators.clear();

		this.log('ConversationState destroyed successfully');
	}

	/**
	 * Get performance metrics for this conversation
	 */
	getMetrics(): ConversationStateMetrics {
		return {
			...this.metrics,
			avgComputeTime: this.metrics.displayMessagesComputations > 0
				? this.metrics.displayMessagesComputeTime / this.metrics.displayMessagesComputations
				: 0
		};
	}
}
