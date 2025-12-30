<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import DelegationPreview from '../../DelegationPreview.svelte';

	interface Delegation {
		recipient?: string;
		prompt?: string;
	}

	interface DelegateArgs {
		delegations?: Delegation[];
		mode?: string;
	}

	interface Props {
		args: DelegateArgs | null;
		event?: NDKEvent;
	}

	let { args, event }: Props = $props();

	const delegations = $derived(args?.delegations || []);

	// Extract q tags from the event - these are the conversation IDs for each delegation
	const qTags = $derived(event?.getMatchingTags('q') || []);

	// Map delegations to their conversation IDs
	// Each q tag corresponds to a delegation (in order)
	const delegationsWithIds = $derived(
		delegations.map((delegation, index) => ({
			...delegation,
			conversationId: qTags[index]?.[1] || null
		}))
	);
</script>

<div class="delegation-container">
	{#each delegationsWithIds as delegation, i (delegation.conversationId || i)}
		{#if delegation.conversationId}
			<DelegationPreview
				conversationId={delegation.conversationId}
				recipientName={delegation.recipient}
				prompt={delegation.prompt}
			/>
		{:else}
			<!-- Fallback for delegations without q tag (shouldn't happen normally) -->
			<div class="fallback-delegation">
				Delegating to <code>{delegation.recipient}</code>
			</div>
		{/if}
	{/each}
</div>

<style>
	.delegation-container {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.fallback-delegation {
		font-size: 0.875rem;
		color: hsl(var(--muted-foreground));
	}

	.fallback-delegation code {
		padding: 2px 6px;
		background: hsl(var(--muted));
		border-radius: 4px;
		font-size: 0.75rem;
	}
</style>
