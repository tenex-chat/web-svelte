<script lang="ts">
	import type { NDKAgentDefinition } from '$lib/events/NDKAgentDefinition';
	import { generateAgentColor } from '$lib/utils/agent-colors';

	interface Props {
		agent: NDKAgentDefinition;
		onclick?: () => void;
	}

	let { agent, onclick }: Props = $props();

	const agentColor = $derived(generateAgentColor(agent.name || agent.id));
	const initials = $derived(agent.name ? agent.name?.slice(0, 2).toUpperCase() : 'AG');
</script>

<button
	onclick={onclick}
	class="w-full text-left bg-card border border-border rounded-lg hover:shadow-lg transition-shadow p-4 space-y-3"
>
	<!-- Header with Avatar and Name -->
	<div class="flex items-start gap-3">
		<div
			class="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
			style="background-color: {agentColor}"
		>
			{#if agent.picture}
				<img src={agent.picture} alt={agent.name} class="w-full h-full rounded-full object-cover" />
			{:else}
				{initials}
			{/if}
		</div>

		<div class="flex-1 min-w-0">
			<h3 class="font-semibold text-foreground truncate">
				{agent.name || 'Unnamed Agent Definition'}
			</h3>
			{#if agent.role}
				<span class="inline-block px-2 py-0.5 text-xs bg-muted text-foreground rounded mt-1">
					{agent.role}
				</span>
			{/if}
		</div>

		{#if agent.version}
			<span class="text-xs text-muted-foreground border border-border dark:border-zinc-600 px-2 py-0.5 rounded">
				v{agent.version}
			</span>
		{/if}
	</div>

	<!-- Description -->
	<p class="text-sm text-muted-foreground line-clamp-3">
		{agent.description || 'No description provided'}
	</p>

	<!-- Phases indicator -->
	{#if agent.phases && agent.phases.length > 0}
		<div class="flex items-center gap-2">
			<span class="inline-flex items-center px-2 py-1 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
				<svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 6h16M4 12h16M4 18h16"
					/>
				</svg>
				{agent.phases.length} phase{agent.phases.length !== 1 ? 's' : ''}
			</span>
		</div>
	{/if}

	<!-- Author -->
	<div class="pt-3 border-t border-gray-100 dark:border-zinc-700 flex items-center justify-between text-xs text-muted-foreground">
		<span class="truncate">{agent.pubkey?.slice(0, 16)}...</span>
		{#if agent.created_at}
			<span>{new Date(agent.created_at * 1000).toLocaleDateString()}</span>
		{/if}
	</div>
</button>
