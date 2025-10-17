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
	let buttonElement: HTMLButtonElement | null = $state(null);
	let dropdownPosition = $state({ top: 0, left: 0 });

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

	function handleToggle() {
		if (!isOpen && buttonElement) {
			// Calculate position when opening
			const rect = buttonElement.getBoundingClientRect();
			dropdownPosition = {
				top: rect.top - 8, // 8px above button
				left: rect.left
			};
		}
		isOpen = !isOpen;
	}
</script>

<div class="flex items-center gap-1">
	<!-- Agent Selector Dropdown -->
	<div class="relative">
		<button
			bind:this={buttonElement}
			type="button"
			onclick={handleToggle}
			class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent transition-colors text-sm min-w-0"
		>
			{#if displayAgent}
				<!-- Avatar -->
				<Avatar {ndk} pubkey={displayAgent.pubkey} size={20} />

				<!-- Agent Name -->
				<span class="font-medium text-sm text-foreground truncate">{displayAgent.name}</span>
			{/if}

			<!-- Dropdown Icon -->
			<ChevronDown class="w-4 h-4 text-muted-foreground flex-shrink-0" />
		</button>

		<!-- Dropdown Menu (with fixed positioning to escape overflow) -->
		{#if isOpen}
			<div
				use:clickOutside={handleClickOutside}
				class="fixed w-64 bg-card border border-border rounded-lg shadow-lg overflow-hidden"
				style="top: {dropdownPosition.top}px; left: {dropdownPosition.left}px; z-index: 9999; transform: translateY(-100%);"
			>
				<div class="max-h-80 overflow-y-auto">
					<!-- Default Option -->
					<button
						type="button"
						onclick={() => handleSelect(null)}
						class="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left {!selectedAgent && defaultAgent === agents[0]?.pubkey
							? 'bg-primary/10'
							: ''}"
					>
						{#if agents[0]}
							<Avatar {ndk} pubkey={agents[0].pubkey} size={32} />
							<div class="flex-1 min-w-0">
								<div class="font-medium text-sm text-foreground">Project Manager (default)</div>
								<div class="text-xs text-muted-foreground">{agents[0].name}</div>
							</div>
						{/if}
						{#if !selectedAgent && defaultAgent === agents[0]?.pubkey}
							<svg class="w-4 h-4 text-primary flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
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
						<div class="border-t border-border my-1"></div>
					{/if}

					<!-- Other Agents -->
					{#each agents.slice(1) as agent (agent.pubkey)}
						{@const isActive = selectedAgent === agent.pubkey || (!selectedAgent && defaultAgent === agent.pubkey)}
						<button
							type="button"
							onclick={() => handleSelect(agent.pubkey)}
							class="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left {isActive
								? 'bg-primary/10'
								: ''}"
						>
							<Avatar {ndk} pubkey={agent.pubkey} size={32} />
							<div class="flex-1 min-w-0">
								<div class="font-medium text-sm text-foreground truncate">{agent.name}</div>
								{#if agent.model}
									<div class="text-xs text-muted-foreground truncate">{agent.model}</div>
								{/if}
							</div>
							{#if isActive}
								<svg class="w-4 h-4 text-primary flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
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
		class="p-2 rounded-lg hover:bg-accent transition-colors"
		title="Configure agent"
		aria-label="Configure agent"
	>
		<Settings class="w-4 h-4 text-muted-foreground" />
	</button>
</div>
