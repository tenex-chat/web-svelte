<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import type { NDKProject } from '$lib/events/NDKProject';
	import AIImageGenerator from '$lib/components/common/AIImageGenerator.svelte';
	import { aiConfigStore } from '$lib/stores/aiConfig.svelte';

	interface Props {
		project: NDKProject;
	}

	let { project }: Props = $props();

	const imageGenEnabled = $derived(aiConfigStore.config.imageGenSettings.enabled && !!aiConfigStore.config.imageGenSettings.model);

	// Sync editing state when project prop changes
	let title = $state('');
	let description = $state('');
	let repoUrl = $state('');
	let picture = $state('');
	let showImageGenerator = $state(false);

	$effect(() => {
		title = project.title || '';
		description = project.description || '';
		repoUrl = project.repoUrl || '';
		picture = project.picture || '';
	});
	let isSaving = $state(false);
	let saveMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);

	async function handleSave() {
		if (!ndk.$currentUser || isSaving) return;

		isSaving = true;
		saveMessage = null;

		try {
			// Update project properties
			project.title = title;
			project.description = description;
			project.repoUrl = repoUrl || undefined;
			project.picture = picture || undefined;

			// Sign and publish the updated project
			await project.publishReplaceable();

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
		repoUrl = project.repoUrl || '';
		picture = project.picture || '';
		showImageGenerator = false;
		saveMessage = null;
	}

	function handleImageAccept(url: string) {
		picture = url;
		showImageGenerator = false;
	}

	function handleImageReject() {
		showImageGenerator = false;
	}

	function handleRemoveImage() {
		picture = '';
	}

	const hasChanges = $derived(
		title !== (project.title || '') ||
		description !== (project.description || '') ||
		repoUrl !== (project.repoUrl || '') ||
		picture !== (project.picture || '')
	);
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
		<!-- Project Image -->
		<div>
			<label class="block text-sm font-medium text-foreground mb-2">
				Project Image
			</label>

			{#if picture && !showImageGenerator}
				<!-- Current Image Display -->
				<div class="flex items-start gap-4">
					<div class="w-24 h-24 rounded-lg overflow-hidden border border-border bg-muted flex-shrink-0">
						<img src={picture} alt="Project" class="w-full h-full object-cover" />
					</div>
					<div class="flex flex-col gap-2">
						<p class="text-xs text-muted-foreground">Current project image</p>
						<div class="flex gap-2">
							{#if imageGenEnabled}
								<button
									onclick={() => showImageGenerator = true}
									class="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
								>
									🎨 Generate New
								</button>
							{/if}
							<button
								onclick={handleRemoveImage}
								class="px-3 py-1.5 text-sm border border-border text-foreground rounded-lg hover:bg-muted transition-colors"
							>
								Remove
							</button>
						</div>
					</div>
				</div>
			{:else if showImageGenerator}
				<!-- AI Image Generator -->
				<div class="border border-border rounded-lg p-4 bg-muted/20">
					<div class="flex items-center justify-between mb-3">
						<h4 class="text-sm font-medium text-foreground">Generate Project Image</h4>
						<button
							onclick={() => showImageGenerator = false}
							class="text-muted-foreground hover:text-foreground transition-colors"
							aria-label="Close generator"
						>
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
					<AIImageGenerator
						placeholder="Describe your project image (e.g., 'A minimalist logo for a coding project with blue accents')"
						initialPrompt={title ? `A project logo or cover image for "${title}"` : ''}
						onAccept={handleImageAccept}
						onReject={handleImageReject}
						acceptLabel="Use as project image"
						compact
					/>
				</div>
			{:else}
				<!-- No Image - Show options -->
				<div class="flex items-center gap-4">
					<div class="w-24 h-24 rounded-lg border-2 border-dashed border-border bg-muted/50 flex items-center justify-center flex-shrink-0">
						<svg class="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
						</svg>
					</div>
					<div class="flex flex-col gap-2">
						<p class="text-sm text-muted-foreground">No project image set</p>
						{#if imageGenEnabled}
							<button
								onclick={() => showImageGenerator = true}
								class="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors w-fit"
							>
								🎨 Generate with AI
							</button>
						{:else}
							<p class="text-xs text-muted-foreground">
								Enable image generation in <a href="/settings" class="underline hover:text-foreground">AI Settings</a> to generate project images.
							</p>
						{/if}
					</div>
				</div>
			{/if}
		</div>

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

		<!-- Repository URL -->
		<div>
			<label for="project-repo" class="block text-sm font-medium text-foreground mb-1">
				Repository URL
			</label>
			<input
				id="project-repo"
				type="text"
				bind:value={repoUrl}
				placeholder="https://github.com/user/repo"
				class="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
			/>
			<p class="text-xs text-muted-foreground mt-1">The URL of your project's repository (e.g., GitHub, GitLab).</p>
		</div>

		<!-- Project ID (Read-only) -->
		<div>
			<label class="block text-sm font-medium text-foreground mb-1">Project ID</label>
			<input
				type="text"
				value={project.encode() || 'Not set'}
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
				class="px-4 py-2 bg-primary hover:bg-primary/90 disabled:bg-secondary disabled:cursor-not-allowed text-primary-foreground rounded-lg transition-colors font-medium"
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
