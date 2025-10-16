<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import type { NDKProject } from '$lib/events/NDKProject';

	interface Props {
		project: NDKProject;
	}

	let { project }: Props = $props();

	const currentUser = $derived(ndk.$sessions.currentUser);

	let title = $state(project.title || '');
	let description = $state(project.description || '');
	let isSaving = $state(false);
	let saveMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);

	async function handleSave() {
		if (!currentUser || isSaving) return;

		isSaving = true;
		saveMessage = null;

		try {
			// Update project properties
			project.title = title;
			project.description = description;

			// Sign and publish the updated project
			await project.sign();
			await project.publish();

			saveMessage = { type: 'success', text: 'Project updated successfully!' };

			// Clear message after 3 seconds
			setTimeout(() => {
				saveMessage = null;
			}, 3000);
		} catch (error) {
			console.error('Failed to update project:', error);
			saveMessage = { type: 'error', text: 'Failed to update project. Please try again.' };
		} finally {
			isSaving = false;
		}
	}

	function handleReset() {
		title = project.title || '';
		description = project.description || '';
		saveMessage = null;
	}

	const hasChanges = $derived(title !== (project.title || '') || description !== (project.description || ''));
</script>

<div class="p-4 max-w-2xl">
	<h2 class="text-lg font-semibold mb-4">General Settings</h2>

	<!-- Save Message -->
	{#if saveMessage}
		<div
			class="mb-4 p-3 rounded-lg {saveMessage.type === 'success'
				? 'bg-green-50 text-green-800 border border-green-200'
				: 'bg-red-50 text-red-800 border border-red-200'}"
		>
			<div class="flex items-center gap-2">
				<span class="text-sm">{saveMessage.text}</span>
			</div>
		</div>
	{/if}

	<div class="space-y-4">
		<!-- Project Title -->
		<div>
			<label for="project-title" class="block text-sm font-medium text-foreground mb-1">
				Project Title
			</label>
			<input
				id="project-title"
				type="text"
				bind:value={title}
				placeholder="My Awesome Project"
				class="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
			/>
			<p class="text-xs text-muted-foreground mt-1">The name of your project.</p>
		</div>

		<!-- Project Description -->
		<div>
			<label for="project-description" class="block text-sm font-medium text-foreground mb-1">
				Description
			</label>
			<textarea
				id="project-description"
				bind:value={description}
				placeholder="Describe your project..."
				rows="4"
				class="w-full px-3 py-2 border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
			></textarea>
			<p class="text-xs text-muted-foreground mt-1">A brief description of what this project is about.</p>
		</div>

		<!-- Project ID (Read-only) -->
		<div>
			<label class="block text-sm font-medium text-foreground mb-1"> Project ID (d-tag) </label>
			<input
				type="text"
				value={project.dTag || 'Not set'}
				readonly
				class="w-full px-3 py-2 border border-border rounded-lg bg-muted text-muted-foreground cursor-not-allowed"
			/>
			<p class="text-xs text-muted-foreground mt-1">
				This is the unique identifier for your project. It cannot be changed.
			</p>
		</div>

		<!-- Created Date (Read-only) -->
		<div>
			<label class="block text-sm font-medium text-foreground mb-1"> Created </label>
			<input
				type="text"
				value={project.created_at
					? new Date(project.created_at * 1000).toLocaleString()
					: 'Unknown'}
				readonly
				class="w-full px-3 py-2 border border-border rounded-lg bg-muted text-muted-foreground cursor-not-allowed"
			/>
		</div>

		<!-- Action Buttons -->
		<div class="flex items-center gap-2 pt-2">
			<button
				onclick={handleSave}
				disabled={!hasChanges || isSaving}
				class="px-4 py-2 bg-primary hover:bg-primary/90 disabled:bg-secondary disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
			>
				{#if isSaving}
					<span class="flex items-center gap-2">
						<svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
							/>
						</svg>
						Saving...
					</span>
				{:else}
					Save Changes
				{/if}
			</button>

			{#if hasChanges}
				<button
					onclick={handleReset}
					class="px-4 py-2 border border-border hover:bg-muted text-foreground rounded-lg transition-colors"
				>
					Reset
				</button>
			{/if}
		</div>
	</div>
</div>
