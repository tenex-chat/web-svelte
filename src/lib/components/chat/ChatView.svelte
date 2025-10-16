<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import type { NDKProject } from '$lib/events/NDKProject';
	import type { ProjectAgent } from '$lib/events/NDKProjectStatus';
	import type { ThreadViewMode } from '$lib/utils/messageProcessor';
	import type { Message } from '$lib/utils/messageProcessor';
	import MessageList from './MessageList.svelte';
	import ChatInput from './ChatInput.svelte';
	import CopyThreadMenu from './CopyThreadMenu.svelte';

	interface Props {
		project?: NDKProject;
		rootEvent?: NDKEvent | null;
		onlineAgents?: ProjectAgent[];
		onThreadCreated?: (thread: NDKEvent) => void;
		viewMode?: ThreadViewMode;
		hideHeader?: boolean;
		messages?: Message[];
	}

	let { project, rootEvent = null, onlineAgents = [], onThreadCreated, viewMode = $bindable('threaded'), hideHeader = false, messages = $bindable([]) }: Props = $props();

	let localRootEvent = $state<NDKEvent | null>(rootEvent);
	let replyToEvent = $state<NDKEvent | null>(null);
	let initialContent = $state<string>('');

	// Update local root when prop changes
	$effect(() => {
		if (rootEvent) {
			localRootEvent = rootEvent;
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
</script>

<div class="flex flex-col h-full">
	{#if localRootEvent}
		{#if !hideHeader}
			<!-- Chat Header -->
			<div class="border-b border-border px-4 py-3 bg-card">
				<div class="flex items-center justify-between">
					<span class="text-sm font-medium text-foreground">
						{localRootEvent.tagValue('title') || 'Conversation'}
					</span>

					<div class="flex items-center gap-2">
						<!-- Copy Thread Menu -->
						<CopyThreadMenu {messages} rootEvent={localRootEvent} />
					</div>
				</div>
			</div>
		{/if}

		<!-- Messages -->
		<MessageList
			rootEvent={localRootEvent}
			{viewMode}
			onReply={handleReply}
			onQuote={handleQuote}
			bind:messages
		/>

		<!-- Input -->
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
	{:else}
		<!-- New Conversation -->
		<div class="flex-1 flex items-center justify-center text-muted-foreground">
			Start a new conversation
		</div>

		<ChatInput {project} {onlineAgents} onThreadCreated={handleThreadCreated} />
	{/if}
</div>
