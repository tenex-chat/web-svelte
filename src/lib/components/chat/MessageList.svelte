<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { NDKEvent } from '@nostr-dev-kit/ndk';
	import Message from './Message.svelte';
	import SystemMessage from './SystemMessage.svelte';
	import ThreadedMessage from './ThreadedMessage.svelte';
	import { ConversationState } from '$lib/stores/conversation-state.svelte';
	import { type Message as MessageType, calculateMessageProperties } from '$lib/utils/messageUtils';
	import { ChevronDown } from 'lucide-svelte';
	import PerformanceMonitor from './PerformanceMonitor.svelte';

	interface Props {
		rootEvent: NDKEvent;
		viewMode?: 'threaded' | 'flattened';
		onReply?: (message: MessageType) => void;
		onQuote?: (message: MessageType) => void;
		onTimeClick?: (event: NDKEvent) => void;
		messages?: MessageType[];
	}

	let {
		rootEvent,
		viewMode = 'threaded',
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

	// Performance monitor
	let showPerformanceMonitor = $state(false);
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

	// Track the actual rootEvent ID to avoid unnecessary recreations
	let currentRootEventId = $state<string | null>(null);
	let conversationState = $state<ConversationState | null>(null);

	// Create/update ConversationState when rootEvent changes
	$effect(() => {
		const newRootEventId = rootEvent?.id || null;

		// Only recreate if the event ID has actually changed
		if (newRootEventId !== currentRootEventId) {
			// Destroy old state if it exists
			if (conversationState) {
				conversationState.destroy();
				conversationState = null;
			}

			// Create new state with current rootEvent
			if (rootEvent) {
				conversationState = new ConversationState(ndk, rootEvent, {
					viewMode,
					currentUserPubkey: ndk.$currentUser?.pubkey,
					debug: false // Disable debug logging now that issue is fixed
				});

				conversationState.start();
			}

			// Update the tracked ID
			currentRootEventId = newRootEventId;
		}
	});

	// Separate cleanup effect that only runs on unmount
	$effect(() => {
		return () => {
			if (conversationState) {
				conversationState.destroy();
				conversationState = null;
			}
		};
	});

	// Use reactive messages from ConversationState
	const flatMessages = $derived(conversationState?.displayMessages || []);
	const eventsWithMetadata = $derived(conversationState?.displayEventsWithMetadata || []);

	// Sync to bindable messages prop
	$effect(() => {
		messages = flatMessages;
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
			<div class="flex flex-col pb-52">
				<ThreadedMessage {rootEvent} eventId={rootEvent.id} depth={0} {onTimeClick} />
			</div>
		{:else}
			<!-- Flattened view: Render messages and metadata in chronological order -->
			{@const messageProps = calculateMessageProperties(messages)}
			{@const messagePropsMap = new Map(messageProps.map(mp => [mp.message.id, mp]))}
			<div class="flex flex-col">
				{#each eventsWithMetadata as event, index (event.type === 'message' ? (event.data as MessageType).id : (event.data as NDKEvent).id)}
					{#if event.type === 'metadata'}
						<SystemMessage event={event.data as NDKEvent} />
					{:else}
						{@const message = event.data as MessageType}
						{@const props = messagePropsMap.get(message.id)}
						{#if props}
							<Message
								message={props.message}
								isLastMessage={index === eventsWithMetadata.length - 1}
								isConsecutive={props.isConsecutive}
								hasNextConsecutive={props.hasNextConsecutive}
								{onReply}
								{onQuote}
								{onTimeClick}
							/>
						{/if}
					{/if}
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

	<!-- Performance Monitor -->
	<PerformanceMonitor bind:visible={showPerformanceMonitor} />
</div>