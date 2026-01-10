<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { NDKEvent } from '@nostr-dev-kit/ndk';
	import Message from './Message.svelte';
	import AgentMessageBlock from './AgentMessageBlock.svelte';
	import AgentTodoList from './AgentTodoList.svelte';
	import FloatingTodoHeader from './FloatingTodoHeader.svelte';
	import { ConversationState } from '$lib/stores/conversation-state.svelte';
	import { type Message as MessageType, createSimplifiedDisplayModel, type DisplayItem } from '$lib/utils/messageUtils';
	import { aggregateTodoState, type AggregatedTodoState } from '$lib/utils/todoAggregator';
	import { scrollManager } from '$lib/actions/scrollManager';
	import { ChevronDown } from 'lucide-svelte';
	import PerformanceMonitor from './PerformanceMonitor.svelte';

	// Helper to generate unique keys for display items
	function getDisplayItemKey(item: DisplayItem, index: number): string {
		if (item.type === 'visible') {
			return `visible-${item.message.id}`;
		} else {
			return `agent_group-${item.messages[0]?.id || index}`;
		}
	}

	interface Props {
		rootEvent: NDKEvent;
		viewMode?: 'threaded' | 'flattened';
		onReply?: (message: MessageType) => void;
		onQuote?: (message: MessageType) => void;
		onTimeClick?: (event: NDKEvent) => void;
		onSendAgain: (message: MessageType) => void;
		messages?: MessageType[];
	}

	let {
		rootEvent,
		viewMode = 'threaded',
		onReply,
		onQuote,
		onTimeClick,
		onSendAgain,
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

	// Create unified display model using $derived
	const displayList = $derived<DisplayItem[]>(
		createSimplifiedDisplayModel(flatMessages)
	);

	// Aggregate todos from ALL messages (not per-group)
	const globalTodoState = $derived<AggregatedTodoState>(
		aggregateTodoState(flatMessages.map(m => m.event))
	);

	// Find the index of the first display item that should show the todo list
	// (first agent group that contains a todo-related tool call)
	const todoDisplayIndex = $derived.by(() => {
		if (!globalTodoState.hasTodos) return -1;

		for (let i = 0; i < displayList.length; i++) {
			const item = displayList[i];
			const msgs = item.type === 'agent_group' ? item.messages : [item.message];
			const hasTodoEvent = msgs.some(m => {
				const toolName = m.event.tagValue('tool');
				return toolName === 'todo_add' || toolName === 'todo_update' || toolName === 'TodoWrite';
			});

			if (hasTodoEvent) return i;
		}
		return -1;
	});

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
	// IMPORTANT: Do NOT reference messages.length here - it would create a dependency
	// that re-runs this effect on every message change, recreating the scroll manager
	// and triggering unwanted scroll-to-bottom
	$effect(() => {
		if (scrollContainer) {
			scrollManagerInstance = scrollManager(scrollContainer, {
				onScrollChange: handleScrollChange,
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
	<!-- Floating Todo Header - positioned top-right -->
	{#if globalTodoState.hasTodos}
		<FloatingTodoHeader items={globalTodoState.items} />
	{/if}

	<div
		bind:this={scrollContainer}
		class="absolute inset-0 overflow-y-auto pb-48"
	>

		{#if messages.length === 0}
			<div class="flex items-center justify-center h-full text-muted-foreground text-sm">
				No messages yet. Start the conversation!
			</div>
		{:else}
			<!-- Render from unified display model with agent grouping -->
			<div class="flex flex-col">
				{#each displayList as item, index (getDisplayItemKey(item, index))}
					{#if item.type === 'agent_group'}
						<AgentMessageBlock
							messages={item.messages}
							isConsecutive={item.isConsecutive}
							hasNextConsecutive={item.hasNextConsecutive}
							isLastInParent={index === displayList.length - 1}
							showTodoList={false}
							rootEventId={rootEvent.id}
							{onReply}
							{onQuote}
							{onTimeClick}
							{onSendAgain}
						/>
					{:else}
						<AgentMessageBlock
							messages={[item.message]}
							isConsecutive={item.isConsecutive}
							hasNextConsecutive={item.hasNextConsecutive}
							isLastInParent={index === displayList.length - 1}
							showTodoList={false}
							rootEventId={rootEvent.id}
							{onReply}
							{onQuote}
							{onTimeClick}
							{onSendAgain}
						/>
					{/if}

					<!-- Render the global todo list after the first block that has todo events -->
					{#if index === todoDisplayIndex && globalTodoState.hasTodos}
						<div class="px-4 py-1">
							<div class="flex gap-3">
								<div class="w-4 flex-shrink-0 relative">
									<div class="absolute left-1/2 -translate-x-1/2 inset-y-0 border-l border-border/60"></div>
								</div>
								<div class="flex-1">
									<AgentTodoList items={globalTodoState.items} />
								</div>
							</div>
						</div>
					{/if}
				{/each}
			</div>
		{/if}
	</div>

	<!-- Scroll to bottom button -->
	{#if showScrollButton}
		<div class="absolute bottom-32 right-4 z-[10000]">
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
