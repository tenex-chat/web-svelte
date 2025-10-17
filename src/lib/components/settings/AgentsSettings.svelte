<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import type { NDKProject } from '$lib/events/NDKProject';
	import type { ProjectAgent } from '$lib/events/NDKProjectStatus';
	import { NDKKind } from '@nostr-dev-kit/ndk';

	interface Props {
		project: NDKProject;
		onlineAgents?: ProjectAgent[];
	}

	let { project, onlineAgents = [] }: Props = $props();

	const currentUser = $derived(ndk.$sessions.currentUser);

	// Subscribe to agent definitions (kind:4199)
	const agentDefsSubscription = ndk.$subscribe(() => ({
		filters: [
			{
				kinds: [4199],
				'#a': [project.tagId()]
			}
		],
		closeOnEose: false
	}));

	const agentDefinitions = $derived(agentDefsSubscription.events);

	let showAddAgent = $state(false);
	let newAgentPubkey = $state('');
	let newAgentName = $state('');
	let isAddingAgent = $state(false);

	async function handleAddAgent() {
		if (!currentUser || !newAgentPubkey.trim() || !newAgentName.trim() || isAddingAgent) return;

		isAddingAgent = true;
		try {
			// Add agent reference to project
			project.addAgent(newAgentPubkey.trim(), newAgentName.trim());

			// Sign and publish updated project
			await project.sign();
			await project.publish();

			// Reset form
			newAgentPubkey = '';
			newAgentName = '';
			showAddAgent = false;
		} catch (error) {
			console.error('Failed to add agent:', error);
		} finally {
			isAddingAgent = false;
		}
	}

	async function handleRemoveAgent(pubkey: string) {
		if (!currentUser) return;

		try {
			// Remove agent from project tags
			project.tags = project.tags.filter((tag) => {
				return !(tag[0] === 'agent' && tag[1] === pubkey);
			});

			// Sign and publish updated project
			await project.sign();
			await project.publish();
		} catch (error) {
			console.error('Failed to remove agent:', error);
		}
	}

	// Get current project agents from tags
	const projectAgents = $derived.by(() => {
		return project.tags
			.filter((tag) => tag[0] === 'agent')
			.map((tag) => ({
				pubkey: tag[1],
				name: tag[2] || 'Unknown',
				isGlobal: tag[3] === 'global'
			}));
	});
</script>

<div class="p-4">
	<div class="flex items-center justify-between mb-4">
		<h2 class="text-lg font-semibold">Agents</h2>
		<button
			onclick={() => (showAddAgent = !showAddAgent)}
			class="px-3 py-1.5 bg-primary hover:bg-primary/90 text-white rounded text-sm font-medium transition-colors"
		>
			{showAddAgent ? 'Cancel' : 'Add Agent'}
		</button>
	</div>

	<!-- Add Agent Form -->
	{#if showAddAgent}
		<div class="mb-4 p-4 border border-border rounded-lg bg-card">
			<h3 class="text-sm font-medium mb-3">Add New Agent</h3>
			<div class="space-y-3">
				<div>
					<label for="agent-name" class="block text-sm font-medium text-foreground mb-1">
						Agent Name
					</label>
					<input
						id="agent-name"
						type="text"
						bind:value={newAgentName}
						placeholder="e.g., Project Manager"
						class="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<div>
					<label for="agent-pubkey" class="block text-sm font-medium text-foreground mb-1">
						Agent Public Key (npub or hex)
					</label>
					<input
						id="agent-pubkey"
						type="text"
						bind:value={newAgentPubkey}
						placeholder="npub1... or hex pubkey"
						class="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<button
					onclick={handleAddAgent}
					disabled={!newAgentName.trim() || !newAgentPubkey.trim() || isAddingAgent}
					class="w-full px-4 py-2 bg-primary hover:bg-primary/90 disabled:bg-secondary disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
				>
					{isAddingAgent ? 'Adding...' : 'Add Agent'}
				</button>
			</div>
		</div>
	{/if}

	<!-- Current Agents List -->
	<div class="space-y-4">
		<!-- Project Agents -->
		<div>
			<h3 class="text-sm font-medium text-foreground mb-2">Project Agents</h3>
			{#if projectAgents.length === 0}
				<div class="text-sm text-muted-foreground p-4 border border-border rounded-lg bg-card text-center">
					No agents configured for this project yet.
				</div>
			{:else}
				<div class="space-y-2">
					{#each projectAgents as agent (agent.pubkey)}
						<div class="p-3 border border-border rounded-lg bg-card">
							<div class="flex items-start justify-between">
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2">
										<span class="font-medium text-sm">{agent.name}</span>
										{#if agent.isGlobal}
											<span
												class="px-1.5 py-0.5 bg-purple-100 text-purple-800 text-xs rounded"
											>
												Global
											</span>
										{/if}
									</div>
									<div class="text-xs text-muted-foreground font-mono truncate mt-1">
										{agent.pubkey}
									</div>
								</div>
								<button
									onclick={() => handleRemoveAgent(agent.pubkey)}
									class="ml-2 p-1 text-muted-foreground hover:text-red-600 rounded transition-colors"
									title="Remove agent"
									aria-label="Remove agent"
								>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
										/>
									</svg>
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Online Agents (Status) -->
		<div>
			<h3 class="text-sm font-medium text-foreground mb-2">Currently Online</h3>
			{#if onlineAgents.length === 0}
				<div class="text-sm text-muted-foreground p-4 border border-border rounded-lg bg-card text-center">
					No agents currently online.
				</div>
			{:else}
				<div class="space-y-2">
					{#each onlineAgents as agent (agent.pubkey)}
						<div class="p-3 border border-green-200 rounded-lg bg-green-50">
							<div class="flex items-center gap-2">
								<div
									class="w-2 h-2 rounded-full bg-green-500 shadow-lg shadow-green-500/50 flex-shrink-0"
								></div>
								<div class="flex-1 min-w-0">
									<div class="font-medium text-sm">{agent.name}</div>
									{#if agent.model}
										<div class="text-xs text-muted-foreground mt-0.5">{agent.model}</div>
									{/if}
									{#if agent.tools && agent.tools.length > 0}
										<div class="text-xs text-muted-foreground mt-1">
											Tools: {agent.tools.join(', ')}
										</div>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Agent Definitions -->
		{#if agentDefinitions.length > 0}
			<div>
				<h3 class="text-sm font-medium text-foreground mb-2">Agent Definitions (kind:4199)</h3>
				<div class="space-y-2">
					{#each agentDefinitions as agentDef (agentDef.id)}
						<div class="p-3 border border-border rounded-lg bg-card">
							<div class="font-medium text-sm">{agentDef.tagValue('name') || 'Unnamed'}</div>
							<div class="text-xs text-muted-foreground mt-1">
								{agentDef.content || 'No description'}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>
