<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import type { Message, ThreadViewMode } from '$lib/utils/messageUtils';
	import CopyThreadMenu from './CopyThreadMenu.svelte';
	import ChatActionsMenu from './ChatActionsMenu.svelte';
	import ConversationMetadataDisplay from './ConversationMetadataDisplay.svelte';
	import { BarChart, MessageSquareText } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';

	type ViewMode = 'threaded' | 'delegation';

	interface Props {
		rootEvent: NDKEvent;
		messages: Message[];
		viewMode: ViewMode;
		onViewModeChange: (mode: ViewMode) => void;
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
			<Button
				variant="ghost"
				size="icon"
				onclick={() => onViewModeChange(viewMode === 'threaded' ? 'delegation' : 'threaded')}
				aria-label="Toggle view mode"
			>
				{#if viewMode === 'threaded'}
					<BarChart class="h-5 w-5" />
				{:else}
					<MessageSquareText class="h-5 w-5" />
				{/if}
			</Button>

			<!-- Chat Actions Menu -->
			{#if messages.length > 0}
				<ChatActionsMenu {rootEvent} {messages} />
			{/if}

			<!-- Copy Thread Menu -->
			<CopyThreadMenu {messages} {rootEvent} />
		</div>
	</div>
</div>
