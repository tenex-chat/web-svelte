<script lang="ts">
	import ndk from '$lib/ndk.svelte';
	import type { NDKAgentDefinition } from '$lib/events/NDKAgentDefinition';
	import { onMount } from 'svelte';

	const currentUser = $derived(ndk.$currentUser);

	let agents = $state<NDKAgentDefinition[]>([]);
	let loading = $state(true);

	onMount(async () => {
		if (!currentUser) {
			loading = false;
			return;
		}

		try {
			const agentEvents = await ndk.fetchEvents({
				kinds: [4199],
				authors: [currentUser.pubkey]
			});

			agents = Array.from(agentEvents) as NDKAgentDefinition[];
		} catch (error) {
			console.error('Failed to fetch agents:', error);
		} finally {
			loading = false;
		}
	});
</script>

<div class="space-y-6">
	<!-- Owned Agents Section -->
	<div class="bg-card rounded-lg border border-border p-6">
		<h3 class="text-lg font-semibold text-foreground mb-4">Your Agents</h3>
		<p class="text-sm text-muted-foreground mb-4">
			Agents you've created and published to the Nostr network
		</p>

		{#if !currentUser}
			<div class="text-center py-8 text-muted-foreground">
				<p class="text-sm">Please login to view your agents</p>
			</div>
		{:else if loading}
			<div class="text-center py-8">
				<div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
				<p class="text-sm text-muted-foreground mt-2">Loading agents...</p>
			</div>
		{:else if agents.length === 0}
			<div class="text-center py-8 text-muted-foreground">
				<p class="text-sm">No agents found</p>
				<p class="text-xs mt-1">Create an agent to get started</p>
			</div>
		{:else}
			<div class="space-y-3">
				{#each agents as agent (agent.id)}
					<div class="p-4 border border-border rounded-lg hover:bg-muted dark:hover:bg-zinc-800">
						<div class="flex items-start justify-between">
							<div class="flex-1">
								<h4 class="text-sm font-medium text-foreground">
									{agent.name || 'Unnamed Agent'}
								</h4>
								{#if agent.description}
									<p class="text-xs text-muted-foreground mt-1">{agent.description}</p>
								{/if}
								<div class="flex gap-2 mt-2">
									<span class="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
										Kind {agent.kind}
									</span>
									{#if agent.created_at}
										<span class="text-xs px-2 py-1 bg-muted text-muted-foreground rounded">
											{new Date(agent.created_at * 1000).toLocaleDateString()}
										</span>
									{/if}
								</div>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Agent Info Section -->
	<div class="bg-blue-50 dark:bg-blue-900 rounded-lg p-4">
		<p class="text-xs text-blue-900 dark:text-blue-100 font-medium mb-1">About Agents</p>
		<p class="text-xs text-blue-700 dark:text-blue-300">
			Agents are autonomous AI assistants that can perform tasks, respond to events, and interact
			with your projects. They are defined using NIP-4199 and stored on the Nostr network.
		</p>
	</div>
</div>
