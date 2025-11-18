<script lang="ts">
	import ndk from '$lib/ndk.svelte';
	import { NDKAgentDefinition } from '$lib/events/NDKAgentDefinition';
	import { NDKKind } from '$lib/kinds';
	import AgentDefinitionCard from '$lib/components/agents/AgentDefinitionCard.svelte';
	import { SvelteSet, SvelteMap } from 'svelte/reactivity';
	import { cn } from '$lib/utils/cn';

	interface Props {
		selectedAgents: SvelteSet<NDKAgentDefinition>;
	}

	let { selectedAgents = $bindable(new SvelteSet()) }: Props = $props();

	// Subscribe to all agent definitions
	const agentsSubscription = ndk.$subscribe(() => ({
		filters: [{ kinds: [NDKKind.AgentDefinition as number] }],
		closeOnEose: true
	}));

	// Transform and deduplicate agents by slug/name (keep latest version)
	const agents = $derived.by(() => {
		const allAgents = agentsSubscription.events.map(event => NDKAgentDefinition.from(event));

		// Group agents by slug or name
		const agentGroups = new SvelteMap<string, NDKAgentDefinition[]>();

		allAgents.forEach((agent) => {
			const groupKey = agent.slug || agent.name || agent.id;

			if (!agentGroups.has(groupKey)) {
				agentGroups.set(groupKey, []);
			}
			const group = agentGroups.get(groupKey);
			if (group) {
				group.push(agent);
			}
		});

		// For each group, keep only the latest version
		const latestAgents: NDKAgentDefinition[] = [];

		agentGroups.forEach((groupAgents) => {
			if (groupAgents.length === 1) {
				latestAgents.push(groupAgents[0]);
			} else {
				// Sort by created_at timestamp (newest first) and version number
				const sorted = groupAgents.sort((a, b) => {
					const timeA = a.created_at || 0;
					const timeB = b.created_at || 0;
					if (timeA !== timeB) {
						return timeB - timeA;
					}

					const versionA = parseInt(a.version || '0');
					const versionB = parseInt(b.version || '0');
					return versionB - versionA;
				});

				latestAgents.push(sorted[0]);
			}
		});

		return latestAgents;
	});

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
