<script lang="ts">
	import type { ProjectAgent } from '$lib/events/NDKProjectStatus';
	import { ndk } from '$lib/ndk.svelte';
	import { Avatar } from '@nostr-dev-kit/svelte';
	import { ChevronDown, Settings } from 'lucide-svelte';
	import { clickOutside } from '$lib/utils/clickOutside';

	interface Props {
		agents: ProjectAgent[];
		selectedAgent: string | null;      // User's explicit choice
		defaultAgent: string | null;       // Computed upstream in ChatInput
		currentModel?: string | null;
		onSelect: (pubkey: string | null) => void;
		onConfigure: () => void;
	}

	let { agents, selectedAgent, defaultAgent, currentModel, onSelect, onConfigure }: Props = $props();

	let isOpen = $state(false);

	// Pure UI component - just displays what it's given
	const displayAgent = $derived.by(() => {
		const activePubkey = selectedAgent || defaultAgent;
		return agents.find((a) => a.pubkey === activePubkey) || agents[0];
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
			class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-sm min-w-0"
		>
			{#if displayAgent}
				<!-- Avatar -->
				<Avatar {ndk} pubkey={displayAgent.pubkey} size={20} />

				<!-- Agent Name -->
				<span class="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{displayAgent.name}</span>
			{/if}

			<!-- Dropdown Icon -->
			<ChevronDown class="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
		</button>

		<!-- Dropdown Menu -->
		{#if isOpen}
			<div
				use:clickOutside={handleClickOutside}
				class="absolute bottom-full left-0 mb-2 w-64 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 rounded-lg shadow-lg overflow-hidden z-50"
			>
				<div class="max-h-80 overflow-y-auto">
					<!-- Default Option -->
					<button
						type="button"
						onclick={() => handleSelect(null)}
						class="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors text-left {!selectedAgent && defaultAgent === agents[0]?.pubkey
							? 'bg-blue-50 dark:bg-blue-900/50'
							: ''}"
					>
						{#if agents[0]}
							<Avatar {ndk} pubkey={agents[0].pubkey} size={32} />
							<div class="flex-1 min-w-0">
								<div class="font-medium text-sm text-gray-900 dark:text-gray-100">Project Manager (default)</div>
								<div class="text-xs text-gray-500 dark:text-gray-400">{agents[0].name}</div>
							</div>
						{/if}
						{#if !selectedAgent && defaultAgent === agents[0]?.pubkey}
							<svg class="w-4 h-4 text-blue-600 dark:text-blue-300 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
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
						<div class="border-t border-gray-200 dark:border-zinc-700 my-1"></div>
					{/if}

					<!-- Other Agents -->
					{#each agents.slice(1) as agent (agent.pubkey)}
						{@const isActive = selectedAgent === agent.pubkey || (!selectedAgent && defaultAgent === agent.pubkey)}
						<button
							type="button"
							onclick={() => handleSelect(agent.pubkey)}
							class="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors text-left {isActive
								? 'bg-blue-50 dark:bg-blue-900/50'
								: ''}"
						>
							<Avatar {ndk} pubkey={agent.pubkey} size={32} />
							<div class="flex-1 min-w-0">
								<div class="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{agent.name}</div>
								{#if agent.model}
									<div class="text-xs text-gray-500 dark:text-gray-400 truncate">{agent.model}</div>
								{/if}
							</div>
							{#if isActive}
								<svg class="w-4 h-4 text-blue-600 dark:text-blue-300 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
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
		class="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
		title="Configure agent"
		aria-label="Configure agent"
	>
		<Settings class="w-4 h-4 text-gray-600 dark:text-gray-400" />
	</button>
</div>
