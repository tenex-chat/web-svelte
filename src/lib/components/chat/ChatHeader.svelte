<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import type { Message } from '$lib/utils/messageProcessor';
	import CopyThreadMenu from './CopyThreadMenu.svelte';
	import ChatActionsMenu from './ChatActionsMenu.svelte';
	import ConversationMetadataDisplay from './ConversationMetadataDisplay.svelte';

	interface Props {
		rootEvent: NDKEvent;
		messages: Message[];
	}

	const { rootEvent, messages }: Props = $props();

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
			<!-- Chat Actions Menu -->
			{#if messages.length > 0}
				<ChatActionsMenu {rootEvent} {messages} />
			{/if}

			<!-- Copy Thread Menu -->
			<CopyThreadMenu {messages} {rootEvent} />
		</div>
	</div>
</div>
