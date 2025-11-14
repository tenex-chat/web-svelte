<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { NDKEvent } from '@nostr-dev-kit/ndk';
	import { NDKKind } from '$lib/kinds';
	import Message from './Message.svelte';
	import ThreadedMessage from './ThreadedMessage.svelte';
	import { processEventsToMessages, type Message as MessageType } from '$lib/utils/messageProcessor';
	import { streamingMessageStore } from '$lib/utils/streamingMessageStore.svelte';
	import { calculateMessageProperties } from '$lib/utils/messageUtils';
	import { ChevronDown } from 'lucide-svelte';

	interface Props {
		rootEvent: NDKEvent;
		viewMode?: 'threaded' | 'flattened';
		isBrainstorm?: boolean;
		onReply?: (message: Message) => void;
		onQuote?: (message: Message) => void;
		onTimeClick?: (event: NDKEvent) => void;
		messages?: Message[];
	}

	let {
		rootEvent,
		viewMode = 'threaded',
		isBrainstorm = false,
		onReply,
		onQuote,
		onTimeClick,
		messages = $bindable([])
	}: Props = $props();

	// Scroll management
	let scrollContainer: HTMLDivElement;
	let isUserAtBottom = $state(true);
	let showScrollButton = $state(false);
	let unreadMessageCount = $state(0);
	const SCROLL_THRESHOLD = 150; // pixels from bottom to consider "at bottom"

	// User scroll intent detection
	let isUserScrolling = $state(false);
	let isProgrammaticScroll = $state(false);
	let scrollDebounceTimer: number | undefined;
	const SCROLL_DEBOUNCE_MS = 150; // Time to wait after scroll stops to detect user intent

	// Check if user is at bottom of scroll container
	function checkScrollPosition() {
		if (!scrollContainer) return;

		const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
		const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

		const wasAtBottom = isUserAtBottom;
		isUserAtBottom = distanceFromBottom < SCROLL_THRESHOLD;

		// Show button if user scrolled up, hide if at bottom
		showScrollButton = !isUserAtBottom && messages.length > 0;

		// Reset unread count when user scrolls to bottom
		if (isUserAtBottom && !wasAtBottom) {
			unreadMessageCount = 0;
		}

		// Detect user-initiated scrolling (not programmatic)
		if (!isProgrammaticScroll) {
			isUserScrolling = true;

			// Clear existing timer
			if (scrollDebounceTimer) {
				clearTimeout(scrollDebounceTimer);
			}

			// Set timer to detect when user stops scrolling
			scrollDebounceTimer = window.setTimeout(() => {
				isUserScrolling = false;
			}, SCROLL_DEBOUNCE_MS);
		}
	}

	// Scroll to bottom smoothly
	function scrollToBottom(smooth = true) {
		if (!scrollContainer) return;

		// Mark this as a programmatic scroll to prevent triggering user scroll detection
		isProgrammaticScroll = true;

		scrollContainer.scrollTo({
			top: scrollContainer.scrollHeight,
			behavior: smooth ? 'smooth' : 'instant'
		});

		unreadMessageCount = 0;
		showScrollButton = false;
		isUserAtBottom = true;

		// Reset the flag after a brief delay to allow the scroll event to complete
		setTimeout(() => {
			isProgrammaticScroll = false;
		}, 100);
	}


	// Subscribe to all messages in this conversation
	// Need to explicitly include streaming and typing events
	const messagesSubscription = ndk.$subscribe(() => ({
		filters: isBrainstorm
			? [
					{ kinds: [1111, 7], ...rootEvent.filter() },
					{ kinds: [1111, 7], ...rootEvent.nip22Filter() }
				]
			: [
					{ kinds: [11, 1111, 7, 513], ...rootEvent.filter() },
					{ kinds: [11, 1111, 7, 513], ...rootEvent.nip22Filter() },

					// streaming events only the ones a few
					{ kinds: [
						NDKKind.TenexAgentTypingStart,
						NDKKind.TenexAgentTypingStop,
						NDKKind.TenexStreamingResponse
					], limit: 5, ...rootEvent.nip22Filter() },
				],
		subId: 'message-list',
		closeOnEose: false,
		bufferMs: 30
	}));

	// Track processed events to avoid reprocessing
	let processedStreamingEvents = new Set<string>();
	let processedFinalEvents = new Set<string>();

	// DIAGNOSTIC: Track what pubkeys have had their streaming events deleted
	let deletedStreamingEventPubkeys = new Set<string>();

	// Cache for processed messages to enable incremental updates
	let processedMessagesCache = new Map<string, MessageType>();
	let lastProcessedEventIds = new Set<string>();

	// DIAGNOSTIC: Track effect runs
	let streamingEffectRunCount = 0;
	let lastSubscriptionEventCount = 0;

	// Process streaming events separately for immediate updates
	$effect(() => {
		streamingEffectRunCount++;
		const currentEventCount = messagesSubscription.events.length;

		console.log(`[DIAGNOSTIC] Streaming effect run #${streamingEffectRunCount}`, {
			timestamp: Date.now(),
			subscriptionEventCount: currentEventCount,
			eventCountChanged: currentEventCount !== lastSubscriptionEventCount,
			previousEventCount: lastSubscriptionEventCount,
			processedStreamingEvents: processedStreamingEvents.size,
			processedFinalEvents: processedFinalEvents.size
		});

		// DIAGNOSTIC: Check for duplicate events in subscription
		const eventIdCounts = new Map<string, number>();
		for (const event of messagesSubscription.events) {
			eventIdCounts.set(event.id, (eventIdCounts.get(event.id) || 0) + 1);
		}
		const duplicates = Array.from(eventIdCounts.entries()).filter(([, count]) => count > 1);
		if (duplicates.length > 0) {
			console.warn('[DIAGNOSTIC] DUPLICATE EVENTS IN SUBSCRIPTION', {
				duplicates: duplicates.map(([id, count]) => ({
					id: id.substring(0, 16),
					count,
					event: messagesSubscription.events.find(e => e.id === id)
				}))
			});
		}

		// Process streaming and typing events
		const streamingEvents = messagesSubscription.events.filter(e =>
			e.kind === NDKKind.TenexStreamingResponse ||
			e.kind === NDKKind.TenexAgentTypingStart
		);

		console.log('[DIAGNOSTIC] Streaming events in subscription', {
			total: streamingEvents.length,
			eventIds: streamingEvents.map(e => e.id.substring(0, 16)),
			alreadyProcessed: streamingEvents.filter(e => processedStreamingEvents.has(e.id)).length
		});

		// Process only new streaming/typing events
		let newStreamingEventCount = 0;
		let reprocessedEventCount = 0;
		for (const event of streamingEvents) {
			const wasDeletedFromTracking = deletedStreamingEventPubkeys.has(event.pubkey);
			const hasFinalMessage = Array.from(processedFinalEvents).some(finalEventId => {
				const finalEvent = messagesSubscription.events.find(e => e.id === finalEventId);
				return finalEvent?.pubkey === event.pubkey;
			});

			if (!processedStreamingEvents.has(event.id)) {
				if (wasDeletedFromTracking || hasFinalMessage) {
					console.error('[DIAGNOSTIC] 🔄 REPROCESSING streaming event (LOOP DETECTED!)', {
						eventId: event.id.substring(0, 16),
						pubkey: event.pubkey.substring(0, 16),
						reason: 'Event was deleted from tracking after final message',
						wasDeletedFromTracking,
						hasFinalMessage,
						thisIsTheBug: '← This is the loop! We should NOT reprocess these events'
					});
					reprocessedEventCount++;
				} else {
					console.log('[DIAGNOSTIC] Processing NEW streaming event', {
						eventId: event.id.substring(0, 16),
						pubkey: event.pubkey.substring(0, 16)
					});
				}
				streamingMessageStore.processStreamingEvent(event);
				processedStreamingEvents.add(event.id);
				newStreamingEventCount++;
			}
		}

		if (reprocessedEventCount > 0) {
			console.error('[DIAGNOSTIC] ❌ LOOP CONFIRMED: Reprocessed events count:', reprocessedEventCount);
			console.error('[DIAGNOSTIC] 🐛 ROOT CAUSE: Lines 259-267 delete streaming events from tracking, causing them to be reprocessed');
		}

		console.log('[DIAGNOSTIC] Processed new streaming events', { count: newStreamingEventCount });

		// Handle typing indicator stop events
		const typingStopEvents = messagesSubscription.events.filter(e =>
			e.kind === NDKKind.TenexAgentTypingStop
		);
		for (const event of typingStopEvents) {
			streamingMessageStore.clearSession(event.pubkey);
		}

		// Clear sessions when final messages arrive
		const finalMessages = messagesSubscription.events.filter(e => e.kind === NDKKind.GenericReply);

		console.log('[DIAGNOSTIC] Final messages in subscription', {
			total: finalMessages.length,
			eventIds: finalMessages.map(e => e.id.substring(0, 16)),
			alreadyProcessed: finalMessages.filter(e => processedFinalEvents.has(e.id)).length
		});

		let newFinalMessageCount = 0;
		for (const event of finalMessages) {
			if (!processedFinalEvents.has(event.id)) {
				const relatedStreamingEvents = streamingEvents.filter(e => e.pubkey === event.pubkey);
				console.log('[DIAGNOSTIC] Processing NEW final message', {
					eventId: event.id.substring(0, 16),
					pubkey: event.pubkey.substring(0, 16),
					clearingSession: true,
					relatedStreamingEventCount: relatedStreamingEvents.length,
					relatedStreamingEventIds: relatedStreamingEvents.map(e => e.id.substring(0, 16)),
					aboutToDeleteFromTracking: true
				});
				streamingMessageStore.clearSession(event.pubkey);
				processedFinalEvents.add(event.id);
				newFinalMessageCount++;

				// DIAGNOSTIC: This line is SUSPICIOUS - it removes streaming events from tracking
				// which causes them to be reprocessed on the next effect run!
				console.warn('[DIAGNOSTIC] ⚠️ DELETING STREAMING EVENTS FROM TRACKING', {
					pubkey: event.pubkey.substring(0, 16),
					deletingEventIds: relatedStreamingEvents.map(e => e.id.substring(0, 16)),
					reason: 'This will cause these events to be reprocessed on next effect run!'
				});

				deletedStreamingEventPubkeys.add(event.pubkey);

				streamingEvents
					.filter(e => e.pubkey === event.pubkey)
					.forEach(e => {
						console.log('[DIAGNOSTIC] Deleting event from processedStreamingEvents', {
							eventId: e.id.substring(0, 16),
							wasProcessed: processedStreamingEvents.has(e.id)
						});
						processedStreamingEvents.delete(e.id);
					});

				console.log('[DIAGNOSTIC] After deleting streaming events', {
					processedStreamingEventsSize: processedStreamingEvents.size,
					remainingIds: Array.from(processedStreamingEvents).map(id => id.substring(0, 16))
				});
			}
		}

		console.log('[DIAGNOSTIC] Processed new final messages', { count: newFinalMessageCount });

		// DIAGNOSTIC: Summary of this effect run
		console.log(`[DIAGNOSTIC] ═══ EFFECT #${streamingEffectRunCount} SUMMARY ═══`, {
			newStreamingEvents: newStreamingEventCount,
			reprocessedStreamingEvents: reprocessedEventCount,
			newFinalMessages: newFinalMessageCount,
			totalProcessedStreamingEvents: processedStreamingEvents.size,
			totalProcessedFinalEvents: processedFinalEvents.size,
			deletedStreamingEventPubkeysCount: deletedStreamingEventPubkeys.size,
			subscriptionEventCount: currentEventCount,
			loopDetected: reprocessedEventCount > 0 ? '🔴 YES - BUG ACTIVE!' : '🟢 NO'
		});

		lastSubscriptionEventCount = currentEventCount;
	});

	// DIAGNOSTIC: Track derived recalculations
	let derivedRecalcCount = 0;

	// Process raw events into flat messages with streaming support - OPTIMIZED
	const flatMessages = $derived.by(() => {
		derivedRecalcCount++;
		const startTime = Date.now();

		console.log(`[DIAGNOSTIC] flatMessages derived recalculating #${derivedRecalcCount}`, {
			timestamp: startTime,
			subscriptionEventCount: messagesSubscription.events.length,
			streamingSessionCount: Object.keys(streamingMessageStore.sessions).length
		});

		// Always include the root event (kind 11) as the first message
		// The subscription filter doesn't return it because it looks for events that reference the root
		const allEvents = messagesSubscription.events.some((e) => e.id === rootEvent.id)
			? messagesSubscription.events
			: [rootEvent, ...messagesSubscription.events];

		// Filter out streaming events - we handle them separately via the global store
		// Also filter out typing indicators as they're handled by streaming store
		const nonStreamingEvents = allEvents.filter(e =>
			e.kind !== NDKKind.TenexStreamingResponse &&
			e.kind !== NDKKind.TenexAgentTypingStart &&
			e.kind !== NDKKind.TenexAgentTypingStop
		);

		console.log('[DIAGNOSTIC] Events after filtering', {
			total: nonStreamingEvents.length,
			kinds: nonStreamingEvents.reduce((acc, e) => {
				acc[e.kind || 'unknown'] = (acc[e.kind || 'unknown'] || 0) + 1;
				return acc;
			}, {} as Record<string, number>)
		});

		// OPTIMIZATION: Only process NEW events, not all events
		const newEvents: NDKEvent[] = [];
		const currentEventIds = new Set<string>();

		for (const event of nonStreamingEvents) {
			currentEventIds.add(event.id);
			if (!lastProcessedEventIds.has(event.id)) {
				newEvents.push(event);
			}
		}

		// Remove messages for events that no longer exist
		const removedEventIds = new Set<string>();
		for (const eventId of lastProcessedEventIds) {
			if (!currentEventIds.has(eventId) && eventId !== rootEvent.id) {
				processedMessagesCache.delete(eventId);
				removedEventIds.add(eventId);
			}
		}

		// If we have new events, process only those
		let baseMessages: MessageType[];

		if (newEvents.length > 0 || removedEventIds.size > 0) {
			// Process only the new events
			const newMessages = newEvents.length > 0 ? processEventsToMessages(
				newEvents,
				rootEvent,
				'flattened',
				isBrainstorm,
				false,
				ndk.$currentUser?.pubkey
			) : [];

			// Add new messages to cache
			for (const msg of newMessages) {
				processedMessagesCache.set(msg.id, msg);
			}

			// Update our tracking
			lastProcessedEventIds = currentEventIds;

			// Get all messages from cache
			baseMessages = Array.from(processedMessagesCache.values());
		} else {
			// No changes, use cached messages
			baseMessages = Array.from(processedMessagesCache.values());
		}

		// Add active streaming sessions as synthetic messages from the GLOBAL store
		// Access sessions directly as a reactive property, not via getAllSessions()
		const streamingSessions = Object.entries(streamingMessageStore.sessions);
		const streamingMessages: MessageType[] = [];

		if (streamingSessions.length > 0) {
			console.log('[MessageList] Processing streaming sessions from global store', {
				sessionCount: streamingSessions.length
			});
		}

		streamingSessions.forEach(([key, session]) => {
			// Create synthetic event for the streaming message
			const syntheticEvent = new NDKEvent(ndk);
			syntheticEvent.kind = NDKKind.TenexStreamingResponse;
			syntheticEvent.pubkey = session.latestEvent.pubkey;
			syntheticEvent.created_at = session.latestEvent.created_at;
			syntheticEvent.tags = session.latestEvent.tags;
			syntheticEvent.content = session.reconstructedContent;
			syntheticEvent.id = session.latestEvent.id;
			syntheticEvent.sig = session.latestEvent.sig;

			streamingMessages.push({
				id: session.syntheticId,
				event: syntheticEvent
			});
		});

		// Combine and sort all messages
		const allMessages = [...baseMessages, ...streamingMessages].sort((a, b) => {
			const timeA = a.event.created_at || 0;
			const timeB = b.event.created_at || 0;
			return timeA - timeB;
		});

		const endTime = Date.now();
		console.log(`[DIAGNOSTIC] flatMessages derived complete #${derivedRecalcCount}`, {
			duration: endTime - startTime,
			totalMessages: allMessages.length,
			baseMessages: baseMessages.length,
			streamingMessages: streamingMessages.length,
			messageIds: allMessages.map(m => ({ id: m.id.substring(0, 16), kind: m.event.kind }))
		});

		return allMessages;
	});

	// Sync flatMessages to bindable messages prop
	$effect(() => {
		messages = flatMessages;

		// Debug: Log the messages being rendered
		const streamingMsgs = flatMessages.filter(m => m.event.kind === NDKKind.TenexStreamingResponse);
		if (streamingMsgs.length > 0) {
			console.log('[MessageList] Rendering messages with streaming', {
				totalMessages: flatMessages.length,
				streamingMessages: streamingMsgs.length,
				streamingIds: streamingMsgs.map(m => m.id)
			});
		}
	});

	// Auto-scroll when new messages arrive (if user is at bottom AND not actively scrolling)
	let previousMessageCount = 0;
	$effect(() => {
		const currentCount = messages.length;

		// Only process after initial render
		if (scrollContainer && previousMessageCount > 0) {
			const hasNewMessages = currentCount > previousMessageCount;

			if (hasNewMessages) {
				// Only auto-scroll if:
				// 1. User is at bottom
				// 2. User is NOT currently scrolling (to avoid jarring interruptions)
				if (isUserAtBottom && !isUserScrolling) {
					// User is at bottom and not scrolling, auto-scroll to show new message
					// Use requestAnimationFrame to ensure DOM has updated
					requestAnimationFrame(() => scrollToBottom(true));
				} else {
					// User is scrolled up OR actively scrolling, increment unread count
					unreadMessageCount += currentCount - previousMessageCount;
				}
			}
		}

		previousMessageCount = currentCount;
	});

	// Initial scroll to bottom on mount
	$effect(() => {
		if (scrollContainer && messages.length > 0) {
			scrollToBottom(false);
		}
	});

	// Cleanup timer on component destroy
	$effect(() => {
		return () => {
			if (scrollDebounceTimer) {
				clearTimeout(scrollDebounceTimer);
			}
		};
	});
</script>

<div class="relative flex-1">
	<div
		bind:this={scrollContainer}
		onscroll={checkScrollPosition}
		class="absolute inset-0 overflow-y-auto"
	>
		{#if messages.length === 0}
			<div class="flex items-center justify-center h-full text-muted-foreground text-sm">
				No messages yet. Start the conversation!
			</div>
		{:else if viewMode === 'threaded'}
			<!-- Threaded view: Use recursive ThreadedMessage component -->
			<div class="flex flex-col">
				<ThreadedMessage {rootEvent} eventId={rootEvent.id} depth={0} {onTimeClick} />
			</div>
		{:else}
			<!-- Flattened view: Render messages in chronological order -->
			{@const messageProps = calculateMessageProperties(messages)}
			<div class="flex flex-col">
				{#each messageProps as { message, isConsecutive, hasNextConsecutive, isLastReasoningMessage }, index (message.id)}
					<Message
						{message}
						isLastMessage={index === messageProps.length - 1}
						{isConsecutive}
						{hasNextConsecutive}
						{onReply}
						{onQuote}
						{onTimeClick}
					/>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Scroll to bottom button -->
	{#if showScrollButton}
		<div class="absolute bottom-4 right-4 z-10">
			<button
				type="button"
				class="relative rounded-full shadow-lg h-10 w-10 bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors flex items-center justify-center"
				onclick={() => scrollToBottom(true)}
				aria-label="Scroll to bottom"
			>
				<ChevronDown class="h-5 w-5" />
				{#if unreadMessageCount > 0}
					<span class="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs font-semibold rounded-full h-5 min-w-5 px-1 flex items-center justify-center">
						{unreadMessageCount}
					</span>
				{/if}
			</button>
		</div>
	{/if}
</div>
