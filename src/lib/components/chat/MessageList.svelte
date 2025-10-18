<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { NDKEvent, NDKKind } from '@nostr-dev-kit/ndk';
	import Message from './Message.svelte';
	import ThreadedMessage from './ThreadedMessage.svelte';
	import { processEventsToMessages, type Message as MessageType } from '$lib/utils/messageProcessor';
	import { streamingMessageStore } from '$lib/utils/streamingMessageStore.svelte';
	import { EVENT_KINDS } from '$lib/constants';
	import { calculateMessageProperties } from '$lib/utils/messageUtils';

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


	// Subscribe to all messages in this conversation
	// Need to explicitly include streaming and typing events
	const messagesSubscription = ndk.$subscribe(() => ({
		filters: isBrainstorm
			? [
					{ kinds: [1111, 7], ...rootEvent.filter() },
					{ kinds: [1111, 7], ...rootEvent.nip22Filter() }
				]
			: [
					{ kinds: [11, 1111, 7, 21111, 24111, 24112, 513], ...rootEvent.filter() },
					{ kinds: [11, 1111, 7, 21111, 24111, 24112, 513], ...rootEvent.nip22Filter() }
				],
		closeOnEose: false,
		bufferMs: 30
	}));

	// Track processed events to avoid reprocessing
	let processedStreamingEvents = new Set<string>();
	let processedFinalEvents = new Set<string>();

	// Process streaming events separately for immediate updates
	$effect(() => {
		// Process streaming and typing events
		const streamingEvents = messagesSubscription.events.filter(e =>
			e.kind === EVENT_KINDS.STREAMING_RESPONSE ||
			e.kind === EVENT_KINDS.TYPING_INDICATOR
		);

		// Process only new streaming/typing events
		for (const event of streamingEvents) {
			if (!processedStreamingEvents.has(event.id)) {
				streamingMessageStore.processStreamingEvent(event);
				processedStreamingEvents.add(event.id);
			}
		}

		// Handle typing indicator stop events
		const typingStopEvents = messagesSubscription.events.filter(e =>
			e.kind === EVENT_KINDS.TYPING_INDICATOR_STOP
		);
		for (const event of typingStopEvents) {
			streamingMessageStore.clearSession(event.pubkey);
		}

		// Clear sessions when final messages arrive
		const finalMessages = messagesSubscription.events.filter(e => e.kind === NDKKind.GenericReply);
		for (const event of finalMessages) {
			if (!processedFinalEvents.has(event.id)) {
				streamingMessageStore.clearSession(event.pubkey);
				processedFinalEvents.add(event.id);
				// Also clear the streaming events for this pubkey from our tracking
				streamingEvents
					.filter(e => e.pubkey === event.pubkey)
					.forEach(e => processedStreamingEvents.delete(e.id));
			}
		}
	});

	// Process raw events into flat messages with streaming support
	const flatMessages = $derived.by(() => {
		// Always include the root event (kind 11) as the first message
		// The subscription filter doesn't return it because it looks for events that reference the root
		const allEvents = messagesSubscription.events.some((e) => e.id === rootEvent.id)
			? messagesSubscription.events
			: [rootEvent, ...messagesSubscription.events];

		// Filter out streaming events - we handle them separately via the global store
		// Also filter out typing indicators as they're handled by streaming store
		const nonStreamingEvents = allEvents.filter(e =>
			e.kind !== EVENT_KINDS.STREAMING_RESPONSE &&
			e.kind !== EVENT_KINDS.TYPING_INDICATOR &&
			e.kind !== EVENT_KINDS.TYPING_INDICATOR_STOP
		);

		// Get base messages - processEventsToMessages will NOT handle streaming
		// since we filtered them out above
		const baseMessages = processEventsToMessages(
			nonStreamingEvents,
			rootEvent,
			'flattened', // Always process as flattened first
			isBrainstorm,
			false, // showAll
			ndk.$currentUser?.pubkey
		);

		// Add active streaming sessions as synthetic messages from the GLOBAL store
		// Access sessions directly as a reactive property, not via getAllSessions()
		const streamingSessions = Object.entries(streamingMessageStore.sessions);
		const streamingMessages: MessageType[] = [];

		console.log('[MessageList] Processing streaming sessions from global store', {
			sessionCount: streamingSessions.length,
			sessionEntries: streamingSessions
		});

		streamingSessions.forEach(([key, session]) => {
			// Create synthetic event for the streaming message
			const syntheticEvent = new NDKEvent(ndk);
			syntheticEvent.kind = EVENT_KINDS.STREAMING_RESPONSE;
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

		console.log('[MessageList] Combining messages', {
			baseMessages: baseMessages.length,
			streamingMessages: streamingMessages.length
		});

		// Combine and sort all messages
		const allMessages = [...baseMessages, ...streamingMessages].sort((a, b) => {
			const timeA = a.event.created_at || 0;
			const timeB = b.event.created_at || 0;
			return timeA - timeB;
		});

		return allMessages;
	});

	// Sync flatMessages to bindable messages prop
	$effect(() => {
		messages = flatMessages;

		// Debug: Log the messages being rendered
		const streamingMsgs = flatMessages.filter(m => m.event.kind === 21111);
		if (streamingMsgs.length > 0) {
			console.log('[MessageList] Rendering messages with streaming', {
				totalMessages: flatMessages.length,
				streamingMessages: streamingMsgs.length,
				streamingIds: streamingMsgs.map(m => m.id)
			});
		}
	});
</script>

<div class="flex-1 overflow-y-auto">
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
				{@const isStreamingMsg = message.event.kind === 21111}
				{#if isStreamingMsg}
					{console.log('[MessageList] Rendering streaming message in loop', {
						messageId: message.id,
						index,
						content: message.event.content?.substring(0, 100)
					}) || ''}
				{/if}
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
