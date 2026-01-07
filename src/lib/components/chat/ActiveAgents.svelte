<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { operationsStatusStore } from '$lib/stores/operationsStatus.svelte';
	import { stopAgentOperation, stopConversation } from '$lib/ndk-events/operations';
	import type { ProjectAgent } from '$lib/events/NDKProjectStatus';
	import { User } from '$lib/ndk/ui/user';
	import { X, StopCircle, Loader2 } from 'lucide-svelte';

	interface Props {
		eventId: string | undefined;
		projectId: string | undefined;
		onlineAgents: ProjectAgent[];
	}

	let { eventId, projectId, onlineAgents }: Props = $props();

	// Track agents being stopped
	let stoppingAgents = $state(new Set<string>());
	let stoppingAll = $state(false);

	// Get active agents from centralized store
	const activeAgentPubkeys = $derived(
		eventId ? operationsStatusStore.getWorkingAgents(eventId) : []
	);

	// Get agent data for active agents
	const activeAgents = $derived.by(() => {
		return activeAgentPubkeys
			.map((pubkey) => onlineAgents.find((agent) => agent.pubkey === pubkey))
			.filter((agent): agent is ProjectAgent => agent !== undefined);
	});

	async function handleStopAgent(agentPubkey: string) {
		if (!eventId || !projectId || stoppingAgents.has(agentPubkey)) return;

		stoppingAgents.add(agentPubkey);
		stoppingAgents = new Set(stoppingAgents); // trigger reactivity

		try {
			await stopAgentOperation(ndk, projectId, eventId, agentPubkey);
		} finally {
			// Keep spinner for a moment to show feedback
			setTimeout(() => {
				stoppingAgents.delete(agentPubkey);
				stoppingAgents = new Set(stoppingAgents);
			}, 1500);
		}
	}

	async function handleStopAll() {
		if (!eventId || !projectId || stoppingAll) return;

		stoppingAll = true;

		try {
			await stopConversation(ndk, projectId, eventId);
		} finally {
			setTimeout(() => {
				stoppingAll = false;
			}, 1500);
		}
	}
</script>

{#if activeAgents.length > 0}
	<div class="flex items-center gap-1">
		{#each activeAgents as agent (agent.pubkey)}
			{@const isStopping = stoppingAgents.has(agent.pubkey)}
			<User.Root {ndk} pubkey={agent.pubkey}>
				<button
					onclick={() => handleStopAgent(agent.pubkey)}
					class="group relative w-7 h-7 rounded-full"
					class:opacity-60={isStopping}
					disabled={isStopping}
					title={isStopping ? 'Stopping...' : `Click to stop ${agent.name || 'Agent'}`}
				>
					<User.Avatar class="!w-7 !h-7" />

					<!-- Spinner overlay when stopping -->
					{#if isStopping}
						<div class="absolute inset-0 rounded-full bg-overlay/70 flex items-center justify-center">
							<Loader2 class="w-4 h-4 text-white animate-spin" />
						</div>
					{:else}
						<!-- X overlay on hover -->
						<div class="absolute inset-0 rounded-full bg-overlay/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
							<X class="w-4 h-4 text-white" />
						</div>
					{/if}
				</button>
			</User.Root>
		{/each}

		<button
			onclick={handleStopAll}
			class="rounded-lg transition-colors"
			class:opacity-60={stoppingAll}
			disabled={stoppingAll}
			title={stoppingAll ? 'Stopping...' : 'Stop all'}
		>
			{#if stoppingAll}
				<Loader2 class="w-7 h-7 text-muted dark:text-muted-foreground animate-spin" />
			{:else}
				<StopCircle class="w-7 h-7 text-muted dark:text-muted-foreground" />
			{/if}
		</button>
	</div>
{/if}