<script lang="ts">
	import { NDKAgentDefinition } from '$lib/events/NDKAgentDefinition';
	import AgentDefinitionCard from '$lib/components/agents/AgentDefinitionCard.svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { cn } from '$lib/utils/cn';
	import { agentStore } from '$lib/stores/agents.svelte';

	interface Props {
		selectedAgents: SvelteSet<NDKAgentDefinition>;
	}

	let { selectedAgents = $bindable(new SvelteSet()) }: Props = $props();

	// Use the centralized agent store (already deduplicated)
	const agents = $derived(agentStore.agents);

	function toggleAgent(agent: NDKAgentDefinition) {
		const newSelected = new SvelteSet(selectedAgents);

		// Check if agent is already selected (compare by id)
		const existing = Array.from(newSelected).find(a => a.id === agent.id);

		if (existing) {
			newSelected.delete(existing);
		} else {
			newSelected.add(agent);
		}

		selectedAgents = newSelected;
	}

	function isSelected(agent: NDKAgentDefinition): boolean {
		return Array.from(selectedAgents).some(a => a.id === agent.id);
	}
</script>

<div class="border border-border rounded-lg p-4">
	{#if agents.length === 0}
		<p class="text-center text-muted-foreground py-8">
			No agents available
		</p>
	{:else}
		<div class="grid gap-4 md:grid-cols-2">
			{#each agents as agent (agent.id)}
				<div
					class={cn(
						'relative rounded-lg transition-all',
						isSelected(agent) && 'ring-2 ring-primary'
					)}
				>
					<AgentDefinitionCard {agent} onclick={() => toggleAgent(agent)} />
					{#if isSelected(agent)}
						<div class="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
							<svg
								class="w-4 h-4 text-primary-foreground"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="3"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M5 13l4 4L19 7"
								/>
							</svg>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
