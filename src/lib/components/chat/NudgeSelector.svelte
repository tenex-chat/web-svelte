<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { NDKKind } from '$lib/kinds';
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { clickOutside } from '$lib/utils/clickOutside';
	import Portal from 'svelte-portal';
	import { Plus } from 'lucide-svelte';

	interface Props {
		selectedNudges: string[];
		onSelectionChange: (selectedIds: string[]) => void;
	}

	let { selectedNudges = $bindable([]), onSelectionChange }: Props = $props();

	let nudges = $state<NDKEvent[]>([]);
	let savedNudges = $state<string[]>([]);
	let isOpen = $state(false);
	let loading = $state(true);
	let buttonElement: HTMLButtonElement | null = $state(null);
	let dropdownPosition = $state({ top: 0, left: 0 });

	onMount(async () => {
		// Load saved nudges
		const saved = localStorage.getItem('saved_nudges');
		if (saved) {
			try {
				savedNudges = JSON.parse(saved);
			} catch {
				savedNudges = [];
			}
		}
		await fetchNudges();
	});

	async function fetchNudges() {
		loading = true;
		try {
			const nudgeEvents = await ndk.fetchEvents({
				kinds: [NDKKind.AgentNudge]
			});

			nudges = Array.from(nudgeEvents).sort((a, b) => {
				const aTime = a.created_at || 0;
				const bTime = b.created_at || 0;
				return bTime - aTime;
			});
		} catch (error) {
			console.error('Failed to fetch nudges:', error);
		} finally {
			loading = false;
		}
	}

	const displayNudges = $derived.by(() => {
		if (!ndk.activeUser?.pubkey) return nudges;
		return nudges.filter((nudge) => {
			return nudge.pubkey === ndk.activeUser?.pubkey || savedNudges.includes(nudge.id);
		});
	});

	function toggleNudge(nudgeId: string) {
		const newSelection = selectedNudges.includes(nudgeId)
			? selectedNudges.filter((id) => id !== nudgeId)
			: [...selectedNudges, nudgeId];

		onSelectionChange(newSelection);
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

	function handleClickOutside() {
		isOpen = false;
	}

	function getNudgeTitle(nudge: NDKEvent): string {
		return nudge.tagValue('title') || 'Untitled Nudge';
	}

	function getNudgeDescription(nudge: NDKEvent): string {
		return nudge.tagValue('description') || '';
	}

	function handleCreateNew() {
		isOpen = false;
		goto('/nudges');
	}
</script>

<div class="relative">
	<button
		bind:this={buttonElement}
		type="button"
		onclick={handleToggle}
		class="relative flex items-center justify-center p-2 rounded-lg border border-border hover:bg-accent transition-colors"
	>
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			class="text-muted-foreground"
		>
			<path d="M12 2L2 7l10 5 10-5-10-5z"></path>
			<path d="M2 17l10 5 10-5"></path>
			<path d="M2 12l10 5 10-5"></path>
		</svg>
		{#if selectedNudges.length > 0}
			<span
				class="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none"
			>
				{selectedNudges.length}
			</span>
		{/if}
	</button>

	{#if isOpen}
		<Portal>
			<div
				use:clickOutside={handleClickOutside}
				class="fixed w-80 bg-card border border-border rounded-lg shadow-lg overflow-hidden"
				style="top: {dropdownPosition.top}px; left: {dropdownPosition.left}px; z-index: 9999; transform: translateY(-100%);"
			>
				{#if loading}
					<div class="p-4 text-center text-sm text-muted-foreground">Loading nudges...</div>
				{:else if displayNudges.length === 0}
					<div class="p-4 text-center text-sm text-muted-foreground">No nudges available</div>
				{:else}
					<div class="max-h-96 overflow-y-auto">
						{#each displayNudges as nudge (nudge.id)}
							{@const isSelected = selectedNudges.includes(nudge.id)}
							<label
								class="flex items-start gap-3 px-3 py-2.5 hover:bg-accent cursor-pointer border-b border-border last:border-b-0"
							>
								<input
									type="checkbox"
									checked={isSelected}
									onchange={() => toggleNudge(nudge.id)}
									class="mt-0.5 cursor-pointer"
								/>
								<div class="flex-1 min-w-0">
									<div class="font-medium text-sm text-foreground">
										{getNudgeTitle(nudge)}
									</div>
									{#if getNudgeDescription(nudge)}
										<div class="text-xs text-muted-foreground mt-0.5">
											{getNudgeDescription(nudge)}
										</div>
									{/if}
								</div>
							</label>
						{/each}
					</div>
				{/if}

				<div class="border-t border-border">
					<button
						type="button"
						onclick={handleCreateNew}
						class="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
					>
						<Plus class="h-4 w-4" />
						Create New Nudge
					</button>
				</div>
			</div>
		</Portal>
	{/if}
</div>
