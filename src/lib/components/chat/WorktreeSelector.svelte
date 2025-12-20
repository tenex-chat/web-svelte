<script lang="ts">
	import { ChevronDown, GitBranch } from 'lucide-svelte';
	import { clickOutside } from '$lib/utils/clickOutside';
	import Portal from 'svelte-portal';

	interface Props {
		worktrees: string[];
		selectedWorktree: string | null;
		defaultWorktree: string | null;
		onSelect: (branch: string | null) => void;
	}

	let { worktrees, selectedWorktree, defaultWorktree, onSelect }: Props = $props();

	let isOpen = $state(false);
	let buttonElement: HTMLButtonElement | null = $state(null);
	let dropdownPosition = $state({ top: 0, left: 0 });

	const displayWorktree = $derived(selectedWorktree || defaultWorktree || worktrees[0]);
	const isUsingDefault = $derived(!selectedWorktree && displayWorktree === defaultWorktree);

	function handleSelect(branch: string | null) {
		onSelect(branch);
		isOpen = false;
	}

	function handleClickOutside() {
		isOpen = false;
	}

	function handleToggle() {
		if (!isOpen && buttonElement) {
			const rect = buttonElement.getBoundingClientRect();
			dropdownPosition = {
				top: rect.top - 8,
				left: rect.left
			};
		}
		isOpen = !isOpen;
	}
</script>

{#if worktrees.length > 0}
	<div class="relative">
		<button
			bind:this={buttonElement}
			type="button"
			onclick={handleToggle}
			class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent transition-colors text-sm min-w-0"
			title="Select worktree/branch"
		>
			<GitBranch class="w-4 h-4 text-muted-foreground flex-shrink-0" />
			<span class="font-medium text-sm text-foreground truncate max-w-[120px]">
				{displayWorktree}
			</span>
			<ChevronDown class="w-4 h-4 text-muted-foreground flex-shrink-0" />
		</button>

		{#if isOpen}
			<Portal>
				<div
					use:clickOutside={handleClickOutside}
					class="fixed w-64 bg-card border border-border rounded-lg shadow-lg overflow-hidden"
					style="top: {dropdownPosition.top}px; left: {dropdownPosition.left}px; z-index: 9999; transform: translateY(-100%);"
				>
					<div class="max-h-screen overflow-y-auto">
						<!-- Default Worktree -->
						{#if defaultWorktree}
							<button
								type="button"
								onclick={() => handleSelect(null)}
								class="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left {isUsingDefault
									? 'bg-primary/10'
									: ''}"
							>
								<GitBranch class="w-5 h-5 text-muted-foreground flex-shrink-0" />
								<div class="flex-1 min-w-0">
									<div class="font-medium text-sm text-foreground truncate">
										{defaultWorktree}
									</div>
									<div class="text-xs text-muted-foreground">Default branch</div>
								</div>
								{#if isUsingDefault}
									<svg class="w-4 h-4 text-primary flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
										<path
											fill-rule="evenodd"
											d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
											clip-rule="evenodd"
										/>
									</svg>
								{/if}
							</button>
						{/if}

						<!-- Separator -->
						{#if worktrees.length > 1}
							<div class="border-t border-border my-1"></div>
						{/if}

						<!-- Other Worktrees -->
						{#each worktrees.slice(1) as branch (branch)}
							{@const isActive = selectedWorktree === branch}
							<button
								type="button"
								onclick={() => handleSelect(branch)}
								class="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left {isActive
									? 'bg-primary/10'
									: ''}"
							>
								<GitBranch class="w-5 h-5 text-muted-foreground flex-shrink-0" />
								<div class="flex-1 min-w-0">
									<div class="font-medium text-sm text-foreground truncate">{branch}</div>
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
			</Portal>
		{/if}
	</div>
{/if}
