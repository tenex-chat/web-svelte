<script lang="ts">
	import { nudgeStore } from '$lib/stores/nudges.svelte';
	import { X } from 'lucide-svelte';

	interface Props {
		selectedNudges: string[];
		onRemoveNudge: (nudgeId: string) => void;
	}

	let { selectedNudges, onRemoveNudge }: Props = $props();

	const shouldDisplay = $derived(selectedNudges.length > 0);
</script>

{#if shouldDisplay}
	<div class="mt-3 flex items-center gap-2 flex-wrap">
		<span class="text-xs text-muted-foreground">Nudges:</span>
		{#each selectedNudges as nudgeId (nudgeId)}
			{@const nudge = nudgeStore.nudges.find((n) => n.id === nudgeId)}
			{#if nudge}
				{@const title = nudge.tagValue('title') || 'Untitled'}
				<span
					class="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 backdrop-blur-sm text-primary rounded-full text-xs"
				>
					<span>/{title}</span>
					<button
						type="button"
						onclick={() => onRemoveNudge(nudgeId)}
						class="hover:bg-primary/20 rounded-full p-0.5"
						aria-label="Remove nudge"
					>
						<X class="w-3 h-3" />
					</button>
				</span>
			{/if}
		{/each}
	</div>
{/if}
