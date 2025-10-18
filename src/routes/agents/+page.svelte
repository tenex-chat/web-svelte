<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { NDKAgentDefinition } from '$lib/events/NDKAgentDefinition';
	import AgentDefinitionCard from '$lib/components/agents/AgentDefinitionCard.svelte';
	import CreateAgentDialog from '$lib/components/dialogs/CreateAgentDialog.svelte';
	import { goto } from '$app/navigation';
	import { SvelteMap } from 'svelte/reactivity';
	import { Plus, Monitor } from 'lucide-svelte';

	let searchQuery = $state('');
	let activeFilter = $state<'all' | 'owned' | 'subscribed'>('all');
	let createDialogOpen = $state(false);

	const agentSubscription = ndk.$subscribe(() => ({ filters: [{ kinds: [NDKAgentDefinition.kind] } ], subId: 'agent-definitions' }));

	const agents = $derived.by(() => {
		const events = agentSubscription.events || [];
		const agentEvents = events.map((event) => NDKAgentDefinition.from(event));

		const agentGroups = new SvelteMap<string, NDKAgentDefinition[]>();

		agentEvents.forEach((agent) => {
			const identifier = agent.slug || agent.dTag || agent.name || agent.id;
			const key = `${agent.pubkey}:${identifier}`;
			if (!agentGroups.has(key)) {
				agentGroups.set(key, []);
			}
			agentGroups.get(key)?.push(agent);
		});

		const latestAgents: NDKAgentDefinition[] = [];

		agentGroups.forEach((groupAgents) => {
			if (groupAgents.length === 1) {
				latestAgents.push(groupAgents[0]);
			} else {
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

	const filteredAgents = $derived.by(() => {
		let filtered = agents;

		if (activeFilter === 'owned' && ndk.$currentUser) {
			filtered = filtered.filter((agent) => agent.pubkey === ndk.$currentUser?.pubkey);
		} else if (activeFilter === 'subscribed' && ndk.$currentUser) {
			filtered = filtered.filter((agent) => agent.pubkey !== ndk.$currentUser?.pubkey);
		}

		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(
				(agent) =>
					agent.name?.toLowerCase().includes(query) ||
					agent.description?.toLowerCase().includes(query) ||
					agent.role?.toLowerCase().includes(query)
			);
		}

		return filtered;
	});

	function handleAgentClick(agent: NDKAgentDefinition) {
		goto(`/agents/${agent.encode()}`);
	}
</script>

<div class="flex-1 flex flex-col">
	<!-- Header -->
	<div class="bg-card border-b border-border">
		<div class="max-w-6xl mx-auto px-4 py-4">
			<div class="flex items-center justify-between mb-4">
				<div>
					<h1 class="text-2xl font-semibold text-foreground">Agent Definitions</h1>
					<p class="text-sm text-muted-foreground mt-1">
						AI assistant templates that can be instantiated for your projects
					</p>
				</div>
				<div class="flex gap-2">
					{#if ndk.$currentUser}
						<button
							onclick={() => (createDialogOpen = true)}
							class="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
						>
							<Plus class="w-4 h-4 mr-2" />
							Create Agent
						</button>
					{/if}
				</div>
			</div>

			<!-- Search and Filter -->
			<div class="flex gap-3">
				<div class="flex-1">
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Search agents by name, description, or role..."
						class="w-full px-4 py-2 border border-border rounded-md bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>
				{#if ndk.$currentUser}
					<select
						bind:value={activeFilter}
						class="px-4 py-2 border border-border rounded-md bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
					>
						<option value="all">All Definitions</option>
						<option value="owned">My Definitions</option>
						<option value="subscribed">Subscribed</option>
					</select>
				{/if}
			</div>
		</div>
	</div>

	<!-- Content -->
	<div class="flex-1 overflow-y-auto bg-background">
		<div class="max-w-6xl mx-auto p-4">
			{#if filteredAgents.length === 0}
				<div class="flex flex-col items-center justify-center py-12">
					<Monitor class="w-12 h-12 text-muted-foreground mb-4" />
					<h3 class="text-lg font-medium text-foreground mb-1">
						{searchQuery ? 'No agent definitions found' : 'No agent definitions yet'}
					</h3>
					<p class="text-sm text-muted-foreground">
						{searchQuery
							? 'Try adjusting your search query'
							: ndk.$currentUser
								? 'Create your first agent definition to get started'
								: 'Sign in to create and manage agent definitions'}
					</p>
				</div>
			{:else}
				<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{#each filteredAgents as agent (agent.id)}
						<AgentDefinitionCard {agent} onclick={() => handleAgentClick(agent)} />
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<CreateAgentDialog bind:open={createDialogOpen} />
