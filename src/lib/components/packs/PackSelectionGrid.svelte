<script lang="ts">
	import ndk from '$lib/ndk.svelte';
	import { NDKAgentDefinitionPack } from '$lib/events/NDKAgentDefinitionPack';
	import { NDKAgentDefinition } from '$lib/events/NDKAgentDefinition';
	import PackCard from '$lib/components/agents/PackCard.svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { agentStore } from '$lib/stores/agents.svelte';

	interface Props {
		selectedAgents: SvelteSet<NDKAgentDefinition>;
	}

	let { selectedAgents = $bindable(new SvelteSet()) }: Props = $props();

	let selectedPackId = $state<string | null>(null);

	// Subscribe to all packs
	const packsSubscription = ndk.$subscribe(() => ({
		filters: [{ kinds: [34199 as number] }],
		closeOnEose: true
	}));

	const packs = $derived(
		packsSubscription.events.map(event => NDKAgentDefinitionPack.from(event))
	);

	// Use centralized agent store (already deduplicated)
	const allAgents = $derived(agentStore.allAgents);

	function handleSelectPack(packId: string) {
		// Toggle pack selection
		if (selectedPackId === packId) {
			selectedPackId = null;
			return;
		}

		selectedPackId = packId;
		const pack = packs.find((p) => p.id === packId);
		if (!pack) return;

		// Find all agents that match the pack's agentEventIds
		const newSelected = new SvelteSet<NDKAgentDefinition>();
		pack.agentEventIds.forEach((agentId) => {
			const agent = allAgents.find(a => a.id === agentId);
			if (agent) {
				newSelected.add(agent);
			}
		});

		selectedAgents = newSelected;
	}
</script>

{#if packs.length > 0}
	<div class="space-y-2">
		<h3 class="text-sm font-medium">Quick Start: Select from a Pack</h3>
		<p class="text-xs text-muted-foreground">
			Choose a pre-configured pack of agents, or select individual agents below
		</p>
		<div class="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
			{#each packs.slice(0, 6) as pack (pack.id)}
				<div class="transform scale-75 origin-top-left">
					<PackCard
						{pack}
						selected={selectedPackId === pack.id}
						onclick={() => handleSelectPack(pack.id)}
					/>
				</div>
			{/each}
		</div>
	</div>
	<div class="border-t border-border pt-4"></div>
{/if}
