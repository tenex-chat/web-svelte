<script lang="ts">
	import type { ProjectAgent } from '$lib/events/NDKProjectStatus';

	interface Props {
		mentionedAgents: string[];
		onlineAgents: ProjectAgent[];
		onRemoveMention: (pubkey: string) => void;
	}

	let { mentionedAgents, onlineAgents, onRemoveMention }: Props = $props();

	const shouldDisplay = $derived(mentionedAgents.length > 1);
</script>

{#if shouldDisplay}
	<div class="mt-3 flex items-center gap-2 flex-wrap">
		<span class="text-xs text-muted-foreground">Mentioning:</span>
		{#each mentionedAgents as pubkey (pubkey)}
			{@const agent = onlineAgents.find((a) => a.pubkey === pubkey)}
			{#if agent}
				<span
					class="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100/50 backdrop-blur-sm text-blue-800 rounded-full text-xs"
				>
					<span>@{agent.name}</span>
					<button
						type="button"
						onclick={() => onRemoveMention(pubkey)}
						class="hover:bg-blue-200/50 rounded-full p-0.5"
						aria-label="Remove mention"
					>
						<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</span>
			{/if}
		{/each}
	</div>
{/if}
