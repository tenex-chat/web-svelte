<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import { type ChatViewMode, type Message } from '$lib/utils/messageUtils';
	import CopyThreadMenu from './CopyThreadMenu.svelte';
	import ChatActionsMenu from './ChatActionsMenu.svelte';
	import ConversationMetadataDisplay from './ConversationMetadataDisplay.svelte';
	import { GitFork, MessageSquareText } from 'lucide-svelte';

	interface Props {
		rootEvent: NDKEvent;
		messages: Message[];
		viewMode: ChatViewMode;
		onViewModeChange: (mode: ChatViewMode) => void;
	}

	const { rootEvent, messages, viewMode, onViewModeChange }: Props = $props();

	const fallbackTitle = $derived(rootEvent.tagValue('title') || 'Conversation');
</script>

<div class="border-b border-border px-4 py-3 bg-card">
	<div class="flex items-center justify-between">
		<div class="flex-1 min-w-0">
			<ConversationMetadataDisplay
				conversationId={rootEvent.id}
				showTitle={true}
				showSummary={true}
				{fallbackTitle}
				summaryClass="text-xs text-muted-foreground italic mt-1 line-clamp-2"
			/>
		</div>

		<div class="flex items-center gap-2 ml-2">
			<!-- View Mode Toggle -->
			<button
				class="p-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
				onclick={() => onViewModeChange(viewMode === 'delegation' ? 'threaded' : 'delegation')}
				aria-label={viewMode === 'delegation' ? 'Switch to thread view' : 'Switch to tree view'}
				title={viewMode === 'delegation' ? 'Switch to thread view' : 'Switch to tree view'}
			>
				{#if viewMode === 'delegation'}
					<MessageSquareText class="h-5 w-5" />
				{:else}
					<GitFork class="h-5 w-5" />
				{/if}
			</button>

			<!-- Chat Actions Menu -->
			{#if messages.length > 0}
				<ChatActionsMenu {rootEvent} {messages} />
			{/if}

			<!-- Copy Thread Menu -->
			<CopyThreadMenu {messages} {rootEvent} />
		</div>
	</div>
</div>
