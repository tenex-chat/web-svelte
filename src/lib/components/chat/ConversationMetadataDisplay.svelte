<script lang="ts">
	import { conversationMetadataStore } from '$lib/stores/conversationMetadata.svelte';

	interface Props {
		conversationId: string | undefined;
		showTitle?: boolean;
		showSummary?: boolean;
		titleClass?: string;
		summaryClass?: string;
		fallbackTitle?: string;
	}

	let {
		conversationId,
		showTitle = false,
		showSummary = true,
		titleClass = 'text-sm font-medium text-foreground',
		summaryClass = 'text-xs text-muted-foreground italic truncate',
		fallbackTitle = 'Conversation'
	}: Props = $props();

	const metadata = $derived(
		conversationId ? conversationMetadataStore.getConversationData(conversationId) : null
	);
</script>

{#if metadata}
	{#if showTitle && metadata.title}
		<div class={titleClass}>{metadata.title}</div>
	{:else if showTitle && fallbackTitle}
		<div class={titleClass}>{fallbackTitle}</div>
	{/if}

	{#if showSummary && metadata.summary}
		<div class={summaryClass}>{metadata.summary}</div>
	{/if}
{/if}
