<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import DelegationPreview from '../../DelegationPreview.svelte';

	interface Props {
		event?: NDKEvent;
	}

	let { event }: Props = $props();

	// Extract q tags from the event - these are the conversation IDs for each delegation
	const conversationIds = $derived(
		(event?.getMatchingTags('q') || []).map(tag => tag[1]).filter(Boolean)
	);
</script>

<div class="delegation-container">
	{#each conversationIds as conversationId (conversationId)}
		<DelegationPreview {conversationId} />
	{/each}
</div>

<style>
	.delegation-container {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
</style>
