<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import { NDKProject } from '$lib/events/NDKProject';
	import type { ProjectAgent } from '$lib/events/NDKProjectStatus';
	import type { ThreadViewMode, Message } from '$lib/utils/messageUtils';
	import { ndk } from '$lib/ndk.svelte';
	import MessageList from './MessageList.svelte';
	import ChatInput from './ChatInput.svelte';
	import ChatHeader from './ChatHeader.svelte';

	interface Props {
		project?: NDKProject;
		projectId?: string;
		rootEvent?: NDKEvent | null;
		threadId?: string;
		onlineAgents?: ProjectAgent[];
		onThreadCreated?: (thread: NDKEvent) => void;
		viewMode?: ThreadViewMode;
		hideHeader?: boolean;
		messages?: Message[];
	}

	let { project = $bindable(), projectId, rootEvent = $bindable(null), threadId, onlineAgents = [], onThreadCreated, viewMode = $bindable('threaded'), hideHeader = false, messages = $bindable([]) }: Props = $props();

	// Fetch project if projectId provided but project not available
	$effect(() => {
		if (projectId && !project) {
			ndk
				.fetchEvent({
					kinds: [31933],
					'#d': [projectId]
				})
				.then((event) => {
					if (event) {
						project = new NDKProject(ndk, event.rawEvent());
					}
				});
		}
	});

	// Fetch thread if threadId provided but rootEvent not available
	$effect(() => {
		if (threadId && !rootEvent) {
			ndk.fetchEvent(threadId).then((event) => {
				if (event) {
					rootEvent = event;
				}
			});
		}
	});

	let localRootEvent = $state<NDKEvent | null>(rootEvent);
	let replyToEvent = $state<NDKEvent | null>(null);
	let initialContent = $state<string>('');
	let navigationStack = $state<NDKEvent[]>([]);

	// Update local root when prop changes
	$effect(() => {
		if (rootEvent && rootEvent.id !== localRootEvent?.id) {
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
		initialContent = '';
	}

	function handleQuote(message: Message) {
		replyToEvent = null;
		// Format the quoted text with markdown quote syntax
		const quotedText = message.event.content
			.split('\n')
			.map((line) => `> ${line}`)
			.join('\n');
		initialContent = `${quotedText}\n\n`;
	}

	function handleCancelReply() {
		replyToEvent = null;
		initialContent = '';
	}

	function handleTimeClick(event: NDKEvent) {
		console.log('handleTimeClick called', event.id);
		console.log('Current root:', localRootEvent?.id);
		console.log('Navigation stack before:', navigationStack.map(e => e.id));

		if (localRootEvent && localRootEvent.id !== event.id) {
			navigationStack = [...navigationStack, localRootEvent];
		}
		localRootEvent = event;

		console.log('New root:', localRootEvent.id);
		console.log('Navigation stack after:', navigationStack.map(e => e.id));
	}
</script>

<div class="flex flex-col h-full relative">
	{#if localRootEvent}
		{#if !hideHeader}
			<ChatHeader rootEvent={localRootEvent} {messages} />
		{/if}

		<!-- Messages -->
		<MessageList
			rootEvent={localRootEvent}
			{viewMode}
			onReply={handleReply}
			onQuote={handleQuote}
			onTimeClick={handleTimeClick}
			bind:messages
		/>

		<!-- Input -->
		 <div class="absolute left-0 right-0 bottom-0 z-[100]">
			<ChatInput
				{project}
				rootEvent={localRootEvent}
				{onlineAgents}
				recentMessages={messages.map(m => m.event)}
				onThreadCreated={handleThreadCreated}
				{replyToEvent}
				{initialContent}
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
