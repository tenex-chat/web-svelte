<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { NDKEvent } from '@nostr-dev-kit/ndk';
	import Message from './Message.svelte';
	import SystemMessage from './SystemMessage.svelte';
	import ThreadedMessage from './ThreadedMessage.svelte';
	import CollapsedMessagesIndicator from './CollapsedMessagesIndicator.svelte';
	import { ConversationState } from '$lib/stores/conversation-state.svelte';
	import { type Message as MessageType, createDisplayModel, type DisplayItem } from '$lib/utils/messageUtils';
	import { scrollManager } from '$lib/actions/scrollManager';
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

	// Scroll state
	let scrollContainer: HTMLDivElement;
	let showScrollButton = $state(false);
	let unreadMessageCount = $state(0);
	let scrollManagerInstance: ReturnType<typeof scrollManager> | null = null;

	// Performance monitor
	let showPerformanceMonitor = $state(false);

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
					debug: true
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

	// Create unified display model using $derived
	const displayList = $derived<DisplayItem[]>(
		viewMode === 'flattened'
			? createDisplayModel(flatMessages, eventsWithMetadata)
			: []
	);

	// Sync to bindable messages prop
	$effect(() => {
		messages = flatMessages;
	});

	// Handle scroll state changes
	function handleScrollChange(isAtBottom: boolean, unreadCount: number) {
		showScrollButton = !isAtBottom && messages.length > 0;
		unreadMessageCount = unreadCount;
	}

	// Scroll to bottom function
	function scrollToBottom() {
		scrollManagerInstance?.scrollToBottom(true);
	}

	// Initialize scroll manager when container is available
	$effect(() => {
		if (scrollContainer) {
			scrollManagerInstance = scrollManager(scrollContainer, {
				onScrollChange: handleScrollChange,
				itemCount: messages.length,
				scrollThreshold: 150,
				scrollDebounceMs: 150
			});

			return () => {
				scrollManagerInstance?.destroy();
			};
		}
	});

	// Update scroll manager when item count changes
	$effect(() => {
		if (scrollManagerInstance) {
			scrollManagerInstance.update({
				itemCount: messages.length
			});
		}
	});
</script>

<div class="relative flex-1">
	<div
		bind:this={scrollContainer}
		class="absolute inset-0 overflow-y-auto"
	>
		{#if messages.length === 0}
			<div class="flex items-center justify-center h-full text-muted-foreground text-sm">
				No messages yet. Start the conversation!
			</div>
		{:else if viewMode === 'threaded'}
			<!-- Threaded view: Use recursive ThreadedMessage component -->
			<div class="flex flex-col pb-52">
				<ThreadedMessage {rootEvent} eventId={rootEvent.id} depth={0} {onTimeClick} {onReply} {onQuote} />
			</div>
		{:else}
			<!-- Flattened view: Render from unified display model -->
			<div class="flex flex-col">
				{#each displayList as item, index (item.type === 'visible' ? item.message.id : item.type === 'collapsed' ? `collapsed-${item.messages[0]?.id || index}` : `metadata-${(item as any).event.id}`)}
					{#if item.type === 'metadata'}
						<SystemMessage event={item.event} />
					{:else if item.type === 'collapsed'}
						<CollapsedMessagesIndicator
							count={item.count}
							messages={item.messages}
							{onReply}
							{onQuote}
							{onTimeClick}
						/>
					{:else if item.type === 'visible'}
						<Message
							message={item.message}
							isLastMessage={index === displayList.length - 1}
							isConsecutive={item.isConsecutive}
							hasNextConsecutive={item.hasNextConsecutive}
							{onReply}
							{onQuote}
							{onTimeClick}
						/>
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
				onclick={scrollToBottom}
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
