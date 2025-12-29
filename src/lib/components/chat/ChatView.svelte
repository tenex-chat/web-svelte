<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import { NDKProject } from '$lib/events/NDKProject';
	import type { ProjectAgent } from '$lib/events/NDKProjectStatus';
	import { type ChatViewMode, type Message } from '$lib/utils/messageUtils';
	import { ndk } from '$lib/ndk.svelte';
	import MessageList from './MessageList.svelte';
	import ChatInput from './ChatInput.svelte';
	import ChatHeader from './ChatHeader.svelte';
	import DelegationTreeView from './DelegationTreeView.svelte';

	interface Props {
		project?: NDKProject;
		projectId?: string;
		rootEvent?: NDKEvent | null;
		threadId?: string;
		onlineAgents?: ProjectAgent[];
		onThreadCreated?: (thread: NDKEvent) => void;
		viewMode?: ChatViewMode;
		hideHeader?: boolean;
		messages?: Message[];
	}

	let { project = $bindable(), projectId, rootEvent = $bindable(null), threadId, onlineAgents = [], onThreadCreated, viewMode = $bindable<ChatViewMode>('threaded'), hideHeader = false, messages = $bindable([]) }: Props = $props();

	// Fetch thread if threadId provided but rootEvent not available
	$effect(() => {
		if (threadId && !rootEvent) {
			alert('This is probably not needed')
			ndk.fetchEvent(threadId).then((event) => {
				if (event) {
					rootEvent = event;
				}
			});
		}
	});

	let localRootEvent = $state<NDKEvent | null>(rootEvent);
	let replyToEvent = $state<NDKEvent | null>(null);
	let quoteEvent = $state<NDKEvent | null>(null);
	let navigationStack = $state<NDKEvent[]>([]);
	let lastPropRootId = $state<string | undefined>(rootEvent?.id);

	// Update local root when prop changes (not from internal navigation)
	$effect(() => {
		if (rootEvent && rootEvent.id !== lastPropRootId) {
			lastPropRootId = rootEvent.id;
			localRootEvent = rootEvent;
			// Clear navigation stack when explicitly setting a new root from props
			navigationStack = [];
		}
	});

	function handleThreadCreated(thread: NDKEvent) {
		localRootEvent = thread;
		if (onThreadCreated) {
			onThreadCreated(thread);
		}
	}

	function handleReply(message: Message) {
		replyToEvent = message.event;
	}

	function handleQuote(message: Message) {
		quoteEvent = message.event;
	}

	function handleCancelReply() {
		replyToEvent = null;
		quoteEvent = null;
	}

	function handleTimeClick(event: NDKEvent) {
		if (localRootEvent && localRootEvent.id !== event.id) {
			navigationStack = [...navigationStack, localRootEvent];
		}
		localRootEvent = event;
	}

	function handleNavigateBack() {
		if (navigationStack.length > 0) {
			const parent = navigationStack[navigationStack.length - 1];
			navigationStack = navigationStack.slice(0, -1);
			localRootEvent = parent;
		}
	}

	const parentEvent = $derived(navigationStack.length > 0 ? navigationStack[navigationStack.length - 1] : null);
</script>

<div class="flex flex-col h-full relative">
	{#if localRootEvent}
		{#if !hideHeader}
			<ChatHeader
				rootEvent={localRootEvent}
				{messages}
				viewMode={viewMode}
				onViewModeChange={(mode) => (viewMode = mode)}
			/>
		{/if}

		<!-- Messages - MessageList always runs for subscription management -->
		<div class={viewMode === 'delegation' ? 'hidden' : 'contents'}>
			<MessageList
				rootEvent={localRootEvent}
				viewMode={viewMode === 'flattened' ? 'flattened' : 'threaded'}
				onReply={handleReply}
				onQuote={handleQuote}
				onTimeClick={handleTimeClick}
				bind:messages
			/>
		</div>

		{#if viewMode === 'delegation'}
			<DelegationTreeView
				rootEvent={localRootEvent}
				{messages}
				isLoading={messages.length === 0}
				onNodeClick={handleTimeClick}
				{parentEvent}
				onNavigateBack={handleNavigateBack}
			/>
		{/if}

		<!-- Input -->
		<div class="absolute left-0 right-0 bottom-0 z-[100]">
			<ChatInput
				{project}
				rootEvent={localRootEvent}
				{onlineAgents}
				recentMessages={messages.map(m => m.event)}
				onThreadCreated={handleThreadCreated}
				{replyToEvent}
				{quoteEvent}
				onCancelReply={handleCancelReply}
			/>
		</div>	
	{:else}
		<!-- New Conversation -->
		<div class="flex-1 flex items-center justify-center text-muted-foreground">
			Start a new conversation
		</div>

		<ChatInput {project} {onlineAgents} onThreadCreated={handleThreadCreated} />
	{/if}
</div>
