<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { NDKAgentDefinition } from '$lib/events/NDKAgentDefinition';
	import AgentDefinitionCard from '$lib/components/agents/AgentDefinitionCard.svelte';

	interface Props {
		eventId: string;
		isPM: boolean;
		disabled: boolean;
		onSetPM: () => void;
		onRemove: () => void;
	}

	let { eventId, isPM, disabled, onSetPM, onRemove }: Props = $props();

	const agentDefinition = ndk.$fetchEvent<NDKAgentDefinition>(() => eventId, { wrap: false });
	console.log('fetched agent definition:', agentDefinition);
</script>

{#if agentDefinition}
	<div class="relative">
		<AgentDefinitionCard agent={NDKAgentDefinition.from(agentDefinition)} />

		<!-- PM Badge and Controls -->
		<div class="flex items-center justify-between mt-2 px-2">
			{#if isPM}
				<span class="inline-flex items-center px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded font-medium">
					<svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
						/>
					</svg>
					Project Manager
				</span>
			{:else}
				<button
					onclick={onSetPM}
					{disabled}
					class="text-xs text-muted-foreground hover:text-foreground underline disabled:opacity-50 disabled:cursor-not-allowed"
				>
					Set as PM
				</button>
			{/if}

			<button
				onclick={onRemove}
				{disabled}
				class="text-xs text-destructive hover:text-destructive/80 underline disabled:opacity-50 disabled:cursor-not-allowed"
			>
				Remove
			</button>
		</div>
	</div>
{:else}
	<div class="p-4 border border-border rounded-lg bg-card">
		<p class="text-sm text-muted-foreground">Loading agent...</p>
	</div>
{/if}
