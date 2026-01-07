<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { NDKKind } from '$lib/kinds';
	import { NDKEvent } from '@nostr-dev-kit/ndk';
	import { clickOutside } from '$lib/utils/clickOutside';
	import Portal from 'svelte-portal';
	import { Plus, SquareSlash } from 'lucide-svelte';
	import { nudgeStore } from '$lib/stores/nudges.svelte';

	interface Props {
		selectedNudges: string[];
		onSelectionChange: (selectedIds: string[]) => void;
	}

	let { selectedNudges = $bindable([]), onSelectionChange }: Props = $props();

	let isOpen = $state(false);
	let buttonElement: HTMLButtonElement | null = $state(null);
	let dropdownPosition = $state({ top: 0, left: 0 });
	let showCreateModal = $state(false);
	let creating = $state(false);
	let newNudge = $state({
		title: '',
		description: '',
		content: '',
		tags: ''
	});

	const displayNudges = $derived(nudgeStore.getDisplayNudges(ndk.activeUser?.pubkey));

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
		showCreateModal = true;
	}

	function handleCloseModal() {
		showCreateModal = false;
		newNudge = {
			title: '',
			description: '',
			content: '',
			tags: ''
		};
	}

	async function createNudge() {
		if (!newNudge.title.trim() || !newNudge.content.trim()) {
			alert('Please fill in title and content');
			return;
		}

		creating = true;
		try {
			const event = new NDKEvent(ndk);
			event.kind = NDKKind.AgentNudge;
			event.content = newNudge.content;
			event.tags = [];

			if (newNudge.title) {
				event.tags.push(['title', newNudge.title]);
			}

			if (newNudge.description) {
				event.tags.push(['description', newNudge.description]);
			}

			if (newNudge.tags) {
				const tags = newNudge.tags.split(',').map((t) => t.trim()).filter(Boolean);
				tags.forEach((tag) => {
					event.tags.push(['t', tag]);
				});
			}

			await event.publish();
			handleCloseModal();
		} catch (error) {
			console.error('Failed to create nudge:', error);
			alert('Failed to create nudge. Please try again.');
		} finally {
			creating = false;
		}
	}

	function handleModalKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			handleCloseModal();
		}
	}
</script>

<div class="relative">
	<button
		bind:this={buttonElement}
		type="button"
		onclick={handleToggle}
		class="relative p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
		title="Select nudges"
		aria-label="Select nudges"
	>
		<SquareSlash class="w-5 h-5" />
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
				{#if displayNudges.length === 0}
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

	<!-- Create Nudge Modal -->
	{#if showCreateModal}
		<Portal>
			<div
				class="fixed inset-0 z-[10000] flex items-center justify-center bg-overlay/50"
				onclick={handleCloseModal}
				onkeydown={handleModalKeydown}
				role="presentation"
				tabindex="0"
			>
				<div
					class="relative w-full max-w-lg bg-card rounded-lg shadow-xl flex flex-col max-h-[90vh] mx-4"
					onclick={(e) => e.stopPropagation()}
					role="dialog"
					aria-modal="true"
				>
				<!-- Close Button -->
				<button
					onclick={handleCloseModal}
					class="absolute top-4 right-4 text-muted-foreground hover:text-foreground z-10"
					aria-label="Close dialog"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>

				<!-- Header -->
				<div class="px-6 pt-6 pb-4 border-b border-border">
					<h2 class="text-xl font-semibold text-foreground">Create New Nudge</h2>
					<p class="text-sm text-muted-foreground mt-1">
						Add a system prompt snippet to guide agent behavior
					</p>
				</div>

				<!-- Content -->
				<div class="flex-1 overflow-y-auto px-6 py-4 space-y-4">
					<div class="space-y-1.5">
						<label for="modal-title" class="block text-sm font-medium text-foreground">
							Title *
						</label>
						<input
							id="modal-title"
							type="text"
							bind:value={newNudge.title}
							placeholder="e.g., Funny, Professional, Concise"
							class="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
						/>
					</div>

					<div class="space-y-1.5">
						<label for="modal-description" class="block text-sm font-medium text-foreground">
							Description
						</label>
						<input
							id="modal-description"
							type="text"
							bind:value={newNudge.description}
							placeholder="Brief description of what this nudge does..."
							class="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
						/>
					</div>

					<div class="space-y-1.5">
						<label for="modal-content" class="block text-sm font-medium text-foreground">
							Content *
						</label>
						<textarea
							id="modal-content"
							bind:value={newNudge.content}
							placeholder="The system prompt text that will be injected..."
							rows="6"
							class="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-y font-mono"
						></textarea>
					</div>

					<div class="space-y-1.5">
						<label for="modal-tags" class="block text-sm font-medium text-foreground">
							Hashtags
						</label>
						<input
							id="modal-tags"
							type="text"
							bind:value={newNudge.tags}
							placeholder="funny, casual, humor"
							class="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
						/>
						<p class="text-xs text-muted-foreground">Separate multiple tags with commas</p>
					</div>
				</div>

				<!-- Footer -->
				<div class="px-6 py-4 border-t border-border flex justify-end gap-2">
					<button
						onclick={handleCloseModal}
						class="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
						disabled={creating}
					>
						Cancel
					</button>
					<button
						onclick={createNudge}
						disabled={creating}
						class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{creating ? 'Creating...' : 'Create Nudge'}
					</button>
				</div>
				</div>
			</div>
		</Portal>
	{/if}
</div>
