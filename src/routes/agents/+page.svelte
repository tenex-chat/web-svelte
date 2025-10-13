<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { NDKAgentDefinition } from '$lib/events/NDKAgentDefinition';
	import AgentDefinitionCard from '$lib/components/agents/AgentDefinitionCard.svelte';
	import CreateAgentDialog from '$lib/components/dialogs/CreateAgentDialog.svelte';
	import { goto } from '$app/navigation';

	let searchQuery = $state('');
	let activeFilter = $state<'all' | 'owned' | 'subscribed'>('all');
	let createDialogOpen = $state(false);

	const currentUser = $derived(ndk.$sessions.currentUser);

	const agentSubscription = ndk.$subscribe({ kinds: [NDKAgentDefinition.kind] });

	const agents = $derived.by(() => {
		const events = agentSubscription.events || [];
		const agentEvents = events.map((event) => NDKAgentDefinition.from(event));

		const agentGroups = new Map<string, NDKAgentDefinition[]>();

		agentEvents.forEach((agent) => {
			const identifier = agent.slug || agent.dTag || agent.name || agent.id;
			if (!agentGroups.has(identifier)) {
				agentGroups.set(identifier, []);
			}
			agentGroups.get(identifier)?.push(agent);
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

		if (activeFilter === 'owned' && currentUser) {
			filtered = filtered.filter((agent) => agent.pubkey === currentUser.pubkey);
		} else if (activeFilter === 'subscribed' && currentUser) {
			filtered = filtered.filter((agent) => agent.pubkey !== currentUser.pubkey);
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
		goto(`/agents/${agent.id}`);
	}
</script>

<div class="flex-1 flex flex-col">
	<!-- Header -->
	<div class="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700">
		<div class="max-w-6xl mx-auto px-4 py-4">
			<div class="flex items-center justify-between mb-4">
				<div>
					<h1 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">Agent Definitions</h1>
					<p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
						AI assistant templates that can be instantiated for your projects
					</p>
				</div>
				<div class="flex gap-2">
					{#if currentUser}
						<button
							onclick={() => (createDialogOpen = true)}
							class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
						>
							<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 4v16m8-8H4"
								/>
							</svg>
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
						class="w-full px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-950 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>
				{#if currentUser}
					<select
						bind:value={activeFilter}
						class="px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
	<div class="flex-1 overflow-y-auto bg-gray-50 dark:bg-zinc-950">
		<div class="max-w-6xl mx-auto p-4">
			{#if filteredAgents.length === 0}
				<div class="flex flex-col items-center justify-center py-12">
					<svg
						class="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
						/>
					</svg>
					<h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
						{searchQuery ? 'No agent definitions found' : 'No agent definitions yet'}
					</h3>
					<p class="text-sm text-gray-500 dark:text-gray-400">
						{searchQuery
							? 'Try adjusting your search query'
							: currentUser
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
