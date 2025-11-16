<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { NDKEvent } from '@nostr-dev-kit/ndk';
	import { NDKKind } from '$lib/kinds';
	import { uiSettingsStore } from '$lib/stores/uiSettings.svelte';
	import Message from './Message.svelte';
	import ThreadedMessage from './ThreadedMessage.svelte';
	import { processEventsToMessages, type Message as MessageType } from '$lib/utils/messageProcessor';
	import { calculateMessageProperties } from '$lib/utils/messageUtils';
	import { ChevronDown } from 'lucide-svelte';

	interface Props {
		rootEvent: NDKEvent;
		viewMode?: 'threaded' | 'flattened';
		isBrainstorm?: boolean;
		onReply?: (message: MessageType) => void;
		onQuote?: (message: MessageType) => void;
		onTimeClick?: (event: NDKEvent) => void;
		messages?: MessageType[];
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

	// SIMPLIFIED: Single subscription for ALL events including streaming
	const messagesSubscription = ndk.$subscribe(() => {
		const streamingKinds: number[] = [
			NDKKind.TenexAgentTypingStart,
			NDKKind.TenexAgentTypingStop
		];
		if (uiSettingsStore.settings.streamingResponsesEnabled) {
			streamingKinds.push(NDKKind.TenexStreamingResponse);
		}

		return {
			filters: isBrainstorm
				? [
						{ kinds: [1111, 7], ...rootEvent.filter() },
						{ kinds: [1111, 7], ...rootEvent.nip22Filter() }
					]
				: [
						{ kinds: [11, 1111, 7, 513], ...rootEvent.filter() },
						{ kinds: [11, 1111, 7, 513], ...rootEvent.nip22Filter() },
						// Include streaming and typing events
						{ kinds: streamingKinds, limit: 100, ...rootEvent.nip22Filter() }
					],
			subId: 'message-list',
			closeOnEose: false,
			bufferMs: 30
		};
	});

	// SIMPLIFIED: Single $derived.by that does ALL processing
	const flatMessages = $derived.by(() => {
		console.log('[MessageList] Processing messages', {
			subscriptionEventCount: messagesSubscription.events.length
		});

		// Include root event if needed
		const allEvents = messagesSubscription.events.some(e => e.id === rootEvent.id)
			? messagesSubscription.events
			: [rootEvent, ...messagesSubscription.events];

		// Process everything in one pass - messageProcessor now handles all streaming logic
		return processEventsToMessages(
			allEvents,
			rootEvent,
			viewMode,
			isBrainstorm,
			false,
			ndk.$currentUser?.pubkey
		);
	});

	// Sync to bindable messages prop
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