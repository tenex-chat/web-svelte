<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { createOperationsSubscription } from '$lib/stores/activeOperations.svelte';
	import { stopAgentOperation, stopConversation } from '$lib/ndk-events/operations';
	import type { ProjectAgent } from '$lib/events/NDKProjectStatus';
	import { Avatar } from '@nostr-dev-kit/svelte';
	import { X, StopCircle } from 'lucide-svelte';

	interface Props {
		eventId: string | undefined;
		projectId: string | undefined;
		onlineAgents: ProjectAgent[];
	}

	let { eventId, projectId, onlineAgents }: Props = $props();

	// Create subscription function for this event
	const getActiveAgents = createOperationsSubscription(eventId, projectId);

	// Subscribe to active operations for this event
	const activeAgentPubkeys = $derived(getActiveAgents());

	// Get agent data for active agents
	const activeAgents = $derived.by(() => {
		return activeAgentPubkeys
			.map((pubkey) => onlineAgents.find((agent) => agent.pubkey === pubkey))
			.filter((agent): agent is ProjectAgent => agent !== undefined);
	});

	async function handleStopAgent(agentPubkey: string) {
		if (!eventId || !projectId) return;
		await stopAgentOperation(ndk, projectId, eventId, agentPubkey);
	}

	async function handleStopAll() {
		if (!eventId || !projectId) return;
		await stopConversation(ndk, projectId, eventId);
	}
</script>

{#if activeAgents.length > 0}
	<div class="flex items-center gap-1">
		{#each activeAgents as agent (agent.pubkey)}
			<button
				onclick={() => handleStopAgent(agent.pubkey)}
				class="group relative w-7 h-7 rounded-full"
				title="Click to stop {agent.name || 'Agent'}"
			>
				<Avatar pubkey={agent.pubkey} {ndk} size="sm" class="w-7 h-7 rounded-full" />

				<!-- Simple X overlay on hover -->
				<div class="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
					<X class="w-4 h-4 text-white" />
				</div>
			</button>
		{/each}

		<!-- Simple stop all button if multiple agents -->
		{#if activeAgents.length > 1}
			<button
				onclick={handleStopAll}
				class="ml-1 p-1.5 rounded-full bg-red-500/20 hover:bg-red-500/30 transition-colors"
				title="Stop all"
			>
				<StopCircle class="w-4 h-4 text-red-600 dark:text-red-400" />
			</button>
		{/if}
	</div>
{/if}