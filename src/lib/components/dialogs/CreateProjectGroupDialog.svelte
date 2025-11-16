<script lang="ts">
	import type { NDKProject } from '$lib/events/NDKProject';
	import { cn } from '$lib/utils/cn';
	import { SvelteSet } from 'svelte/reactivity';

	interface Props {
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		projects: NDKProject[];
		onSave?: (groupName: string, projectIds: string[]) => void;
		onDelete?: () => void;
		editingGroup?: { id: string; name: string; projectIds: string[] } | null;
	}

	let { open = $bindable(false), onOpenChange, projects, onSave, onDelete, editingGroup = null }: Props = $props();

	// State
	let groupName = $state('');
	let selectedProjects = $state<SvelteSet<string>>(new SvelteSet());
	let saving = $state(false);
	let showDeleteConfirm = $state(false);

	// Reset form when dialog opens/closes
	$effect(() => {
		if (open) {
			resetForm();
		}
	});

	function resetForm() {
		if (editingGroup) {
			// Populate form with existing group data
			groupName = editingGroup.name;
			selectedProjects = new SvelteSet(editingGroup.projectIds);
		} else {
			// Clear form for new group
			groupName = '';
			selectedProjects = new SvelteSet();
		}
		saving = false;
		showDeleteConfirm = false;
	}

	// Computed property for dialog title
	const dialogTitle = $derived(editingGroup ? 'Edit Project Group' : 'Create Project Group');
	const dialogDescription = $derived(
		editingGroup
			? 'Update the name and projects in this group'
			: 'Group projects together for easier organization'
	);
	const saveButtonText = $derived(editingGroup ? 'Save Changes' : 'Create Group');

	function handleClose() {
		open = false;
		onOpenChange?.(false);
	}

	function toggleProject(projectId: string) {
		const newSelected = new SvelteSet(selectedProjects);
		if (newSelected.has(projectId)) {
			newSelected.delete(projectId);
		} else {
			newSelected.add(projectId);
		}
		selectedProjects = newSelected;
	}

	function handleSave() {
		if (!canSave()) return;

		saving = true;
		try {
			onSave?.(groupName.trim(), Array.from(selectedProjects));
			handleClose();
		} catch (error) {
			console.error('Failed to save project group:', error);
			alert('Failed to save project group. Please try again.');
		} finally {
			saving = false;
		}
	}

	function canSave(): boolean {
		return groupName.trim() !== '' && selectedProjects.size > 0;
	}

	function handleDelete() {
		showDeleteConfirm = true;
	}

	function confirmDelete() {
		onDelete?.();
		showDeleteConfirm = false;
	}

	function cancelDelete() {
		showDeleteConfirm = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			if (showDeleteConfirm) {
				cancelDelete();
			} else {
				handleClose();
			}
		}
	}

	// Generate project color from dTag (same logic as sidebar)
	function getProjectColor(project: NDKProject): string {
		const str = project.dTag || '';
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			hash = (hash << 5) - hash + str.charCodeAt(i);
			hash = hash & hash;
		}
		const hue = Math.abs(hash) % 360;
		return `hsl(${hue}, 65%, 55%)`;
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-overlay/50"
		onclick={handleClose}
		onkeydown={handleKeydown}
		role="presentation"
		tabindex="0"
	>
		<div
			class="relative w-full max-w-lg max-h-[90vh] bg-card rounded-lg shadow-xl flex flex-col"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
		>
			<!-- Close Button -->
			<button
				onclick={handleClose}
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
			<div class="flex-shrink-0 px-6 pt-6 pb-4 border-b border-border">
				<h2 class="text-xl font-semibold">{dialogTitle}</h2>
				<p class="text-sm text-muted-foreground mt-1">
					{dialogDescription}
				</p>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto px-6 py-4">
				<div class="space-y-4">
					<!-- Group Name Input -->
					<div>
						<label for="group-name" class="block text-sm font-medium mb-1">
							Group Name *
						</label>
						<input
							id="group-name"
							type="text"
							bind:value={groupName}
							class="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-input"
							placeholder="e.g., Work Projects, Personal, etc."
							autofocus
						/>
					</div>

					<!-- Projects Selection -->
					<div>
						<label class="block text-sm font-medium mb-2">
							Select Projects *
							<span class="text-muted-foreground font-normal">
								({selectedProjects.size} selected)
							</span>
						</label>

						<div class="border border-border rounded-lg p-3 max-h-96 overflow-y-auto">
							{#if projects.length === 0}
								<p class="text-center text-muted-foreground py-8">
									No projects available
								</p>
							{:else}
								<div class="space-y-2">
									{#each projects as project (project.dTag || project.id)}
										{@const projectId = project.dTag || project.id || ''}
										{@const projectColor = getProjectColor(project)}
										{@const isSelected = selectedProjects.has(projectId)}

										<button
											onclick={() => toggleProject(projectId)}
											class={cn(
												'w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left',
												isSelected
													? 'bg-primary/10 border-primary/50 ring-2 ring-primary/20'
													: 'border-border hover:bg-muted'
											)}
										>
											<!-- Project Avatar -->
											<div
												class="w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold flex-shrink-0"
												style="background: {projectColor}"
											>
												{project.title?.charAt(0).toUpperCase() || 'P'}
											</div>

											<div class="flex-1 min-w-0">
												<p class="font-medium truncate">
													{project.title || 'Untitled'}
												</p>
												<p class="text-sm text-muted-foreground">
													{project.agents.length} agents
												</p>
											</div>

											{#if isSelected}
												<svg class="w-5 h-5 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M5 13l4 4L19 7"
													/>
												</svg>
											{/if}
										</button>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				</div>
			</div>

			<!-- Footer -->
			<div class="flex-shrink-0 flex gap-3 px-6 py-4 border-t border-border">
				{#if editingGroup}
					<button
						onclick={handleDelete}
						disabled={saving}
						class="px-4 py-2 border border-destructive text-destructive rounded-md hover:bg-destructive hover:text-destructive-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						Delete
					</button>
				{/if}

				<div class="flex-1"></div>

				<button
					onclick={handleClose}
					disabled={saving}
					class="px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				>
					Cancel
				</button>

				<button
					onclick={handleSave}
					disabled={!canSave() || saving}
					class={cn(
						'flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors',
						(!canSave() || saving) && 'opacity-50 cursor-not-allowed'
					)}
				>
					{#if saving}
						<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground"></div>
						Saving...
					{:else}
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M5 13l4 4L19 7"
							/>
						</svg>
						{saveButtonText}
					{/if}
				</button>
			</div>

			<!-- Delete Confirmation Overlay -->
			{#if showDeleteConfirm}
				<div
					class="absolute inset-0 bg-overlay/60 rounded-lg flex items-center justify-center z-10"
					onclick={cancelDelete}
				>
					<div
						class="bg-card rounded-lg p-6 max-w-sm mx-4 shadow-2xl"
						onclick={(e) => e.stopPropagation()}
					>
						<h3 class="text-lg font-semibold mb-2">Delete Project Group?</h3>
						<p class="text-sm text-muted-foreground mb-4">
							Are you sure you want to delete <strong>"{groupName}"</strong>? This action cannot be undone.
						</p>

						<div class="flex gap-3 justify-end">
							<button
								onclick={cancelDelete}
								class="px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
							>
								Cancel
							</button>
							<button
								onclick={confirmDelete}
								class="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors"
							>
								Delete
							</button>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}
