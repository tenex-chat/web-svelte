<script lang="ts">
	import { NDKEvent } from '@nostr-dev-kit/ndk';
	import { NDKProject } from '$lib/events/NDKProject';
	import type { ProjectAgent } from '$lib/events/NDKProjectStatus';
	import { type ChatViewMode, type Message } from '$lib/utils/messageUtils';
	import { ndk } from '$lib/ndk.svelte';
	import MessageList from './MessageList.svelte';
	import ChatInput from './ChatInput.svelte';
	import ChatHeader from './ChatHeader.svelte';
	import SwimlaneDelegationView from './SwimlaneDelegationView.svelte';
	import { windowManager } from '$lib/stores/windowManager.svelte';

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
		windowId?: string;
	}

	let { project = $bindable(), projectId, rootEvent = $bindable(null), threadId, onlineAgents = [], onThreadCreated, viewMode = $bindable<ChatViewMode>('threaded'), hideHeader = false, messages = $bindable([]), windowId }: Props = $props();

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

	// Trim navigation stack when it exceeds 10 items, keeping only the 10 most recent
	$effect(() => {
		if (navigationStack.length > 10) {
			navigationStack = navigationStack.slice(-10);
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

	/**
	 * Handle "send again in new conversation" action.
	 * Creates a new kind:1 event copying all tags from the original except:
	 * - created_at, sig, id, pubkey (these are regenerated)
	 * Then closes the current window and opens a new one with the new conversation.
	 */
	async function handleSendAgain(message: Message) {
		if (!ndk || !ndk.$currentUser || !project) return;

		const originalEvent = message.event;

		// Create a new event copying the original's content and tags
		const newEvent = new NDKEvent(ndk);
		newEvent.kind = 1;
		newEvent.content = originalEvent.content;

		// Copy all tags from the original event
		// The tags include: a-tag (project), p-tag (agents), branch, nudge, q (quote), t (hashtags), etc.
		newEvent.tags = [...originalEvent.tags];

		try {
			// Sign and publish the new event
			await newEvent.sign(undefined, { pTags: false });
			newEvent.publish();

			// Close the current conversation window
			if (windowId) {
				windowManager.close(windowId);
			}

			// Open a new window with the new conversation
			if (project) {
				windowManager.openChat(project, newEvent);
			}
		} catch (error) {
			console.error('Failed to send again in new conversation:', error);
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
				onSendAgain={handleSendAgain}
				bind:messages
			/>
		</div>

		{#if viewMode === 'delegation'}
			<SwimlaneDelegationView
				rootEvent={localRootEvent}
				{messages}
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
