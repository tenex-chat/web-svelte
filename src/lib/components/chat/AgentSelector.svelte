<script lang="ts">
	import type { ProjectAgent } from '$lib/events/NDKProjectStatus';
	import { ndk } from '$lib/ndk.svelte';
	import { Avatar } from '@nostr-dev-kit/svelte';
	import { ChevronDown, Settings } from 'lucide-svelte';
	import { clickOutside } from '$lib/utils/clickOutside';

	interface Props {
		agents: ProjectAgent[];
		selectedAgent: string | null;
		currentModel?: string | null;
		onSelect: (pubkey: string | null) => void;
		onConfigure: () => void;
	}

	let { agents, selectedAgent, currentModel, onSelect, onConfigure }: Props = $props();

	let isOpen = $state(false);

	const displayAgent = $derived.by(() => {
		if (selectedAgent) {
			return agents.find((a) => a.pubkey === selectedAgent);
		}
		return agents[0]; // Default to first agent (Project Manager)
	});

	function handleSelect(pubkey: string | null) {
		onSelect(pubkey);
		isOpen = false;
	}

	function handleClickOutside() {
		isOpen = false;
	}
</script>

<div class="flex items-center gap-1">
	<!-- Agent Selector Dropdown -->
	<div class="relative">
		<button
			type="button"
			onclick={() => (isOpen = !isOpen)}
			class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors text-sm min-w-0"
		>
			{#if displayAgent}
				<!-- Avatar -->
				<Avatar {ndk} pubkey={displayAgent.pubkey} size={20} />

				<!-- Agent Name and Model -->
				<div class="flex flex-col items-start min-w-0">
					<span class="font-medium text-sm truncate">{displayAgent.name}</span>
					{#if currentModel}
						<span class="text-xs text-gray-500 truncate">{currentModel}</span>
					{/if}
				</div>
			{/if}

			<!-- Dropdown Icon -->
			<ChevronDown class="w-4 h-4 text-gray-400 flex-shrink-0" />
		</button>

		<!-- Dropdown Menu -->
		{#if isOpen}
			<div
				use:clickOutside={handleClickOutside}
				class="absolute bottom-full left-0 mb-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-50"
			>
				<div class="max-h-80 overflow-y-auto">
					<!-- Default Option -->
					<button
						type="button"
						onclick={() => handleSelect(null)}
						class="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left {!selectedAgent
							? 'bg-blue-50'
							: ''}"
					>
						{#if agents[0]}
							<Avatar {ndk} pubkey={agents[0].pubkey} size={32} />
							<div class="flex-1 min-w-0">
								<div class="font-medium text-sm">Project Manager (default)</div>
								<div class="text-xs text-gray-500">{agents[0].name}</div>
							</div>
						{/if}
						{#if !selectedAgent}
							<svg class="w-4 h-4 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
								<path
									fill-rule="evenodd"
									d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
									clip-rule="evenodd"
								/>
							</svg>
						{/if}
					</button>

					<!-- Separator -->
					{#if agents.length > 1}
						<div class="border-t border-gray-200 my-1"></div>
					{/if}

					<!-- Other Agents -->
					{#each agents.slice(1) as agent (agent.pubkey)}
						<button
							type="button"
							onclick={() => handleSelect(agent.pubkey)}
							class="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left {selectedAgent ===
							agent.pubkey
								? 'bg-blue-50'
								: ''}"
						>
							<Avatar {ndk} pubkey={agent.pubkey} size={32} />
							<div class="flex-1 min-w-0">
								<div class="font-medium text-sm truncate">{agent.name}</div>
								{#if agent.model}
									<div class="text-xs text-gray-500 truncate">{agent.model}</div>
								{/if}
							</div>
							{#if selectedAgent === agent.pubkey}
								<svg class="w-4 h-4 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
									<path
										fill-rule="evenodd"
										d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
										clip-rule="evenodd"
									/>
								</svg>
							{/if}
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<!-- Configure Button -->
	<button
		type="button"
		onclick={onConfigure}
		class="p-2 rounded-lg hover:bg-gray-100 transition-colors"
		title="Configure agent"
		aria-label="Configure agent"
	>
		<Settings class="w-4 h-4 text-gray-600" />
	</button>
</div>
