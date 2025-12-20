<script lang="ts">
	import type { ProjectAgent } from '$lib/events/NDKProjectStatus';
	import { ndk } from '$lib/ndk.svelte';
	import { User } from '$lib/ndk/ui/user';
	import { ChevronDown, Settings, Hash, Search } from 'lucide-svelte';
	import { clickOutside } from '$lib/utils/clickOutside';
	import Portal from 'svelte-portal';
	import { generateColorFromString } from '$lib/utils/colors';

	interface Props {
		agents: ProjectAgent[];
		selectedAgent: string | null;      // User's explicit choice (can be pubkey or 'hashtag:tag')
		selectedHashtag: string | null;    // Currently selected hashtag
		defaultAgent: string | null;       // Computed upstream in ChatInput
		currentModel?: string | null;
		hashtags: string[];                // Available hashtags
		onSelect: (pubkey: string | null) => void;
		onSelectHashtag: (hashtag: string | null) => void;
		onConfigure: (pubkey: string) => void;
		onClose?: () => void;              // Called when dropdown closes
	}

	let { agents, selectedAgent, selectedHashtag, defaultAgent, currentModel, hashtags, onSelect, onSelectHashtag, onConfigure, onClose }: Props = $props();

	let isOpen = $state(false);
	let filterText = $state('');
	let highlightedIndex = $state(0);
	let filterInputElement: HTMLInputElement | null = $state(null);
	let buttonElement: HTMLButtonElement | null = $state(null);
	let dropdownPosition = $state({ top: 0, left: 0 });

	// Filter and sort agents
	const filteredAgents = $derived(() => {
		const lowerFilter = filterText.toLowerCase();
		return [...agents]
			.filter((a) => !filterText || (a.name || '').toLowerCase().includes(lowerFilter))
			.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
	});

	// Filter hashtags
	const filteredHashtags = $derived(() => {
		const lowerFilter = filterText.toLowerCase().replace(/^#/, '');
		return hashtags.filter((h) => !filterText || h.toLowerCase().includes(lowerFilter));
	});

	// Check if user is typing a new hashtag (starts with # and doesn't exist)
	const newHashtag = $derived(() => {
		if (!filterText.startsWith('#')) return null;
		const tag = filterText.slice(1).toLowerCase().trim();
		if (!tag) return null;
		// Check if this hashtag already exists
		if (hashtags.some((h) => h.toLowerCase() === tag)) return null;
		return tag;
	});

	// Combined list of all selectable items for keyboard navigation
	type SelectableItem = { type: 'agent'; agent: ProjectAgent } | { type: 'hashtag'; hashtag: string } | { type: 'new-hashtag'; hashtag: string };

	const selectableItems = $derived((): SelectableItem[] => {
		const items: SelectableItem[] = [];
		for (const agent of filteredAgents()) {
			items.push({ type: 'agent', agent });
		}
		for (const hashtag of filteredHashtags()) {
			items.push({ type: 'hashtag', hashtag });
		}
		const newTag = newHashtag();
		if (newTag) {
			items.push({ type: 'new-hashtag', hashtag: newTag });
		}
		return items;
	});

	// Reset highlighted index when filter changes
	$effect(() => {
		filterText;
		highlightedIndex = 0;
	});

	// Pure UI component - just displays what it's given
	const displayAgent = $derived.by(() => {
		const activePubkey = selectedAgent || defaultAgent;
		return agents.find((a) => a.pubkey === activePubkey) || agents[0];
	});

	function closeDropdown() {
		isOpen = false;
		filterText = '';
		onClose?.();
	}

	function handleSelect(pubkey: string | null) {
		onSelect(pubkey);
		onSelectHashtag(null); // Clear hashtag selection when selecting an agent
		closeDropdown();
	}

	function handleSelectHashtag(hashtag: string) {
		onSelectHashtag(hashtag);
		onSelect(null); // Clear agent selection when selecting a hashtag
		closeDropdown();
	}

	function handleClickOutside() {
		closeDropdown();
	}

	function handleToggle() {
		if (!isOpen && buttonElement) {
			// Calculate position when opening
			const rect = buttonElement.getBoundingClientRect();
			dropdownPosition = {
				top: rect.top - 8, // 8px above button
				left: rect.left
			};
			// Focus the filter input after opening
			setTimeout(() => filterInputElement?.focus(), 0);
			isOpen = true;
		} else {
			closeDropdown();
		}
	}

	function handleConfigure(pubkey: string, event: MouseEvent) {
		event.stopPropagation();
		onConfigure(pubkey);
		closeDropdown();
	}

	function handleKeyDown(e: KeyboardEvent) {
		const items = selectableItems();
		if (items.length === 0) return;

		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				highlightedIndex = (highlightedIndex + 1) % items.length;
				break;
			case 'ArrowUp':
				e.preventDefault();
				highlightedIndex = (highlightedIndex - 1 + items.length) % items.length;
				break;
			case 'Enter':
				e.preventDefault();
				const item = items[highlightedIndex];
				if (item) {
					if (item.type === 'agent') {
						handleSelect(item.agent.pubkey);
					} else {
						handleSelectHashtag(item.hashtag);
					}
				}
				break;
			case 'Escape':
				e.preventDefault();
				closeDropdown();
				break;
		}
	}

	// Helper to get the index of an agent in the selectable items
	function getAgentIndex(pubkey: string): number {
		return selectableItems().findIndex((item) => item.type === 'agent' && item.agent.pubkey === pubkey);
	}

	// Helper to get the index of a hashtag in the selectable items
	function getHashtagIndex(hashtag: string): number {
		return selectableItems().findIndex((item) => (item.type === 'hashtag' || item.type === 'new-hashtag') && item.hashtag === hashtag);
	}
</script>

<!-- Agent Selector Dropdown -->
<div class="relative">
	<button
		bind:this={buttonElement}
		type="button"
		onclick={handleToggle}
		class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent transition-colors text-sm min-w-0"
	>
		{#if selectedHashtag}
			<!-- Hashtag Display -->
			<Hash class="w-4 h-4" />
			<span
				class="px-2 py-0.5 rounded text-sm font-medium"
				style="background-color: {generateColorFromString(selectedHashtag, 65, 85)}; color: {generateColorFromString(selectedHashtag, 65, 25)};"
			>
				#{selectedHashtag}
			</span>
		{:else if displayAgent}
			<!-- Agent Display -->
			<User.Root {ndk} pubkey={displayAgent.pubkey}>
				<!-- Avatar -->
				<User.Avatar class="w-5 h-5" />

				<!-- Agent Name -->
				<span class="font-medium text-sm text-foreground truncate">{displayAgent.name}</span>
			</User.Root>
		{/if}

		<!-- Dropdown Icon -->
		<ChevronDown class="w-4 h-4 text-muted-foreground flex-shrink-0" />
	</button>

		<!-- Dropdown Menu (portal to escape overflow containers) -->
		{#if isOpen}
			<Portal>
				<div
					use:clickOutside={handleClickOutside}
					class="fixed w-64 bg-card border border-border rounded-lg shadow-lg overflow-hidden flex flex-col"
					style="top: {dropdownPosition.top}px; left: {dropdownPosition.left}px; z-index: 9999; transform: translateY(-100%); max-height: 80vh;"
				>
					<!-- Filter Input -->
					<div class="p-2 border-b border-border flex-shrink-0">
						<div class="relative">
							<Search class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
							<input
								bind:this={filterInputElement}
								bind:value={filterText}
								onkeydown={handleKeyDown}
								type="text"
								placeholder="Filter..."
								class="w-full pl-8 pr-3 py-1.5 text-sm bg-muted/50 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
							/>
						</div>
					</div>

					<div class="overflow-y-auto flex-1">
						<!-- Agents Section -->
						{#each filteredAgents() as agent, i (agent.pubkey)}
							{@const isActive = selectedAgent === agent.pubkey || (!selectedAgent && !selectedHashtag && defaultAgent === agent.pubkey)}
							{@const isHighlighted = highlightedIndex === i}
							<div class="group relative">
								<button
									type="button"
									onclick={() => handleSelect(agent.pubkey)}
									onmouseenter={() => (highlightedIndex = i)}
									class="w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left {isHighlighted
										? 'bg-accent'
										: ''} {isActive ? 'bg-primary/10' : ''}"
								>
									<User.Root {ndk} pubkey={agent.pubkey}>
										<User.Avatar class="w-8 h-8" />
										<div class="flex-1 min-w-0">
											<div class="font-medium text-sm text-foreground truncate">{agent.name}</div>
											{#if agent.model}
												<div class="text-xs text-muted-foreground truncate">{agent.model}</div>
											{/if}
										</div>
									</User.Root>
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
								<button
									type="button"
									onclick={(e) => handleConfigure(agent.pubkey, e)}
									class="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-accent-foreground/10 transition-colors opacity-0 group-hover:opacity-100"
									title="Configure {agent.name}"
									aria-label="Configure {agent.name}"
								>
									<Settings class="w-3.5 h-3.5 text-muted-foreground" />
								</button>
							</div>
						{/each}

						<!-- Hashtags Section -->
						{#if filteredHashtags().length > 0}
							{#if filteredAgents().length > 0}
								<div class="border-t border-border"></div>
							{/if}
							{#each filteredHashtags() as hashtag, i (hashtag)}
								{@const isActive = selectedHashtag === hashtag}
								{@const itemIndex = filteredAgents().length + i}
								{@const isHighlighted = highlightedIndex === itemIndex}
								<button
									type="button"
									onclick={() => handleSelectHashtag(hashtag)}
									onmouseenter={() => (highlightedIndex = itemIndex)}
									class="w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left {isHighlighted
										? 'bg-accent'
										: ''} {isActive ? 'bg-primary/10' : ''}"
								>
									<div
										class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
										style="background-color: {generateColorFromString(hashtag, 65, 85)};"
									>
										<Hash class="w-4 h-4" style="color: {generateColorFromString(hashtag, 65, 25)};" />
									</div>
									<div class="flex-1 min-w-0">
										<div class="font-medium text-sm text-foreground truncate">#{hashtag}</div>
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
						{/if}

						<!-- Create new hashtag option -->
						{#if newHashtag()}
							{@const newTag = newHashtag()!}
							{@const newTagIndex = filteredAgents().length + filteredHashtags().length}
							{@const isHighlighted = highlightedIndex === newTagIndex}
							{#if filteredAgents().length > 0 || filteredHashtags().length > 0}
								<div class="border-t border-border"></div>
							{/if}
							<button
								type="button"
								onclick={() => handleSelectHashtag(newTag)}
								onmouseenter={() => (highlightedIndex = newTagIndex)}
								class="w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left {isHighlighted ? 'bg-accent' : ''}"
							>
								<div
									class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2 border-dashed"
									style="border-color: {generateColorFromString(newTag, 65, 50)}; background-color: {generateColorFromString(newTag, 65, 95)};"
								>
									<Hash class="w-4 h-4" style="color: {generateColorFromString(newTag, 65, 40)};" />
								</div>
								<div class="flex-1 min-w-0">
									<div class="font-medium text-sm text-foreground truncate">Create #{newTag}</div>
									<div class="text-xs text-muted-foreground">Use this hashtag</div>
								</div>
							</button>
						{/if}

						<!-- Empty state -->
						{#if filteredAgents().length === 0 && filteredHashtags().length === 0 && !newHashtag()}
							<div class="px-3 py-4 text-sm text-muted-foreground text-center">
								No matches found
							</div>
						{/if}
					</div>
				</div>
			</Portal>
		{/if}
	</div>
