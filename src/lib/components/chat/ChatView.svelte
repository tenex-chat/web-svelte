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
	}

	let { project, rootEvent = null, onlineAgents = [], onThreadCreated, viewMode = $bindable('threaded'), hideHeader = false }: Props = $props();

	let localRootEvent = $state<NDKEvent | null>(rootEvent);
	let replyToEvent = $state<NDKEvent | null>(null);
	let initialContent = $state<string>('');
	let messages = $state<Message[]>([]);

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
			<div class="border-b border-gray-200 dark:border-zinc-700 px-4 py-3 bg-white dark:bg-zinc-900">
				<div class="flex items-center justify-between">
					<span class="text-sm font-medium text-gray-900 dark:text-gray-100">
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
			onThreadCreated={handleThreadCreated}
			{replyToEvent}
			{initialContent}
			onCancelReply={handleCancelReply}
		/>
	{:else}
		<!-- New Conversation -->
		<div class="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
			Start a new conversation
		</div>

		<ChatInput {project} {onlineAgents} onThreadCreated={handleThreadCreated} />
	{/if}
</div>
