<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { NDKProject } from '$lib/events/NDKProject';
	import { cn } from '$lib/utils/cn';

	interface Props {
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
	}

	let { open = $bindable(false), onOpenChange }: Props = $props();

	let title = $state('');
	let description = $state('');
	let hashtags = $state('');
	let creating = $state(false);

	function handleClose() {
		open = false;
		onOpenChange?.(false);
		title = '';
		description = '';
		hashtags = '';
	}

	async function handleCreate() {
		if (!title.trim() || creating) return;

		creating = true;

		try {
			const project = new NDKProject(ndk);
			project.title = title.trim();
			project.description = description.trim();
			project.hashtags = hashtags
				.split(',')
				.map((t) => t.trim())
				.filter(Boolean);

			await project.publish();

			handleClose();
		} catch (error) {
			console.error('Failed to create project:', error);
			alert('Failed to create project. Please try again.');
		} finally {
			creating = false;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			handleClose();
		}
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
		onclick={handleClose}
		onkeydown={handleKeydown}
		role="presentation"
		tabindex="0"
	>
		<div
			class="relative w-full max-w-lg bg-white rounded-lg shadow-xl p-6"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
		>
			<!-- Close Button -->
			<button
				onclick={handleClose}
				class="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
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
			<h2 class="text-xl font-semibold text-gray-900 mb-4">Create New Project</h2>

			<!-- Form -->
			<div class="space-y-4">
				<div>
					<label for="project-title" class="block text-sm font-medium text-gray-700 mb-1">
						Title
					</label>
					<input
						id="project-title"
						type="text"
						bind:value={title}
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
						placeholder="My Project"
					/>
				</div>

				<div>
					<label for="project-description" class="block text-sm font-medium text-gray-700 mb-1">
						Description
					</label>
					<textarea
						id="project-description"
						bind:value={description}
						rows="3"
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
						placeholder="A brief description of your project"
					></textarea>
				</div>

				<div>
					<label for="project-hashtags" class="block text-sm font-medium text-gray-700 mb-1">
						Tags (comma-separated)
					</label>
					<input
						id="project-hashtags"
						type="text"
						bind:value={hashtags}
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
						placeholder="ai, development, research"
					/>
				</div>
			</div>

			<!-- Actions -->
			<div class="flex gap-3 mt-6">
				<button
					onclick={handleClose}
					class="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
				>
					Cancel
				</button>
				<button
					onclick={handleCreate}
					disabled={!title.trim() || creating}
					class={cn(
						'flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors',
						(!title.trim() || creating) && 'opacity-50 cursor-not-allowed'
					)}
				>
					{creating ? 'Creating...' : 'Create Project'}
				</button>
			</div>
		</div>
	</div>
{/if}
