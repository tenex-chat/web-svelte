<script lang="ts">
	import type { NDKAgentDefinition } from '$lib/events/NDKAgentDefinition';
	import { generateAgentColor } from '$lib/utils/colors';

	interface Props {
		agent: NDKAgentDefinition;
		onclick?: () => void;
	}

	let { agent, onclick }: Props = $props();

	const agentColor = $derived(generateAgentColor(agent.name || agent.id));
	const initials = $derived(agent.name ? agent.name?.slice(0, 2).toUpperCase() : 'AG');
	const proxiedImage = $derived(agent.picture ? `/api/proxy?url=${encodeURIComponent(agent.picture)}` : null);
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
			{#if proxiedImage}
				<img src={proxiedImage} alt={agent.name} class="w-full h-full rounded-full object-cover" crossorigin="anonymous" />
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
			<span class="text-xs text-muted-foreground border border-border px-2 py-0.5 rounded">
				v{agent.version}
			</span>
		{/if}
	</div>

	<!-- Description -->
	<p class="text-sm text-muted-foreground line-clamp-3">
		{agent.description || 'No description provided'}
	</p>

	<!-- Author -->
	<div class="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-muted-foreground">
		<span class="truncate">{agent.pubkey?.slice(0, 16)}...</span>
		{#if agent.created_at}
			<span>{new Date(agent.created_at * 1000).toLocaleDateString()}</span>
		{/if}
	</div>
</button>
