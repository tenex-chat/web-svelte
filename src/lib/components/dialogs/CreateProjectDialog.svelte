<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { NDKProject } from '$lib/events/NDKProject';
	import { NDKAgentDefinition } from '$lib/events/NDKAgentDefinition';
	import { NDKMCPTool } from '$lib/events/NDKMCPTool';
	import { cn } from '$lib/utils/cn';
	import AgentSelectionGrid from '$lib/components/agents/AgentSelectionGrid.svelte';
	import ToolSelectionList from '$lib/components/tools/ToolSelectionList.svelte';
	import PackSelectionGrid from '$lib/components/packs/PackSelectionGrid.svelte';
	import { SvelteSet } from 'svelte/reactivity';

	interface Props {
		open?: boolean;
	}

	let { open = $bindable(false) }: Props = $props();

	type Step = 'details' | 'agents' | 'tools' | 'review';

	// Project data
	let projectData = $state({
		name: '',
		description: '',
		tags: [] as string[],
		imageUrl: '',
		repoUrl: ''
	});

	let currentStep = $state<Step>('details');
	let creating = $state(false);

	// Selected items (now binding actual objects, not IDs)
	let selectedAgents = $state(new SvelteSet<NDKAgentDefinition>());
	let selectedTools = $state(new SvelteSet<NDKMCPTool>());

	// Tag input
	let tagInput = $state('');

	const steps: Step[] = ['details', 'agents', 'tools', 'review'];
	const currentStepIndex = $derived(steps.indexOf(currentStep));

	// Reset form when dialog opens/closes
	$effect(() => {
		if (open) {
			resetForm();
		}
	});

	function resetForm() {
		currentStep = 'details';
		projectData = {
			name: '',
			description: '',
			tags: [],
			imageUrl: '',
			repoUrl: ''
		};
		selectedAgents = new SvelteSet();
		selectedTools = new SvelteSet();
		creating = false;
		tagInput = '';
	}

	function handleClose() {
		open = false;
	}

	function canProceed(): boolean {
		switch (currentStep) {
			case 'details':
				return projectData.name.trim() !== '' && projectData.description.trim() !== '';
			case 'agents':
			case 'tools':
			case 'review':
				return true;
			default:
				return true;
		}
	}

	function handleNext() {
		if (currentStepIndex < steps.length - 1) {
			currentStep = steps[currentStepIndex + 1];
		}
	}

	function handleBack() {
		if (currentStepIndex > 0) {
			currentStep = steps[currentStepIndex - 1];
		}
	}

	function handleAddTag(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			const tag = tagInput.trim();
			if (tag && !projectData.tags.includes(tag)) {
				projectData.tags = [...projectData.tags, tag];
				tagInput = '';
			}
		}
	}

	function removeTag(index: number) {
		projectData.tags = projectData.tags.filter((_, i) => i !== index);
	}

	async function handleCreate() {
		if (!ndk) return;

		creating = true;
		try {
			const project = new NDKProject(ndk);
			project.title = projectData.name;
			project.description = projectData.description;
			project.hashtags = projectData.tags;
			project.picture = projectData.imageUrl || undefined;
			project.repoUrl = projectData.repoUrl || undefined;

			// Add selected agents and their MCP servers
			selectedAgents.forEach((agent) => {
				project.addAgent(agent.id);

				// Also add the MCP servers required by these agents
				if (agent.mcpServers) {
					agent.mcpServers.forEach((mcpId) => {
						project.addMCPTool(mcpId);
					});
				}
			});

			// Add selected tools
			selectedTools.forEach((tool) => {
				project.addMCPTool(tool.id);
			});

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

	function getStepTitle(step: Step): string {
		switch (step) {
			case 'details':
				return 'Project Details';
			case 'agents':
				return 'Select Agents';
			case 'tools':
				return 'MCP Tools';
			case 'review':
				return 'Review & Create';
		}
	}

	function getStepIcon(step: Step): string {
		switch (step) {
			case 'details':
				return 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z';
			case 'agents':
				return 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z';
			case 'tools':
				return 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z';
			case 'review':
				return 'M5 13l4 4L19 7';
		}
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-overlay/50"
		onclick={handleClose}
		onkeydown={handleKeydown}
		role="presentation"
	>
		<div
			class="relative w-full max-w-2xl max-h-[90vh] bg-card rounded-lg shadow-xl flex flex-col"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.stopPropagation();
				}
			}}
			role="dialog"
			aria-modal="true"
			tabindex="-1"
		>
			<!-- Close Button -->
			<button
				onclick={handleClose}
				class="absolute top-4 right-4 text-muted-foreground hover:text-muted-foreground z-10"
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
				<h2 class="text-xl font-semibold">Create New Project</h2>
				<p class="text-sm text-muted-foreground mt-1">
					Step {currentStepIndex + 1} of {steps.length}: {getStepTitle(currentStep)}
				</p>
			</div>

			<!-- Step indicators -->
			<div class="flex-shrink-0 flex items-center justify-center gap-2 py-4 px-6">
				{#each steps as step, index}
					<div
						class={cn(
							'flex items-center gap-2',
							index <= currentStepIndex ? 'text-primary' : 'text-muted-foreground'
						)}
					>
						<div
							class={cn(
								'flex h-8 w-8 items-center justify-center rounded-full border-2',
								index <= currentStepIndex
									? 'border-primary bg-primary text-primary-foreground'
									: 'border-border'
							)}
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d={getStepIcon(step)}
								/>
							</svg>
						</div>
						{#if index < steps.length - 1}
							<div
								class={cn(
									'h-0.5 w-8',
									index < currentStepIndex ? 'bg-primary' : 'bg-border'
								)}
							/>
						{/if}
					</div>
				{/each}
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto px-6 py-4">
				{#if currentStep === 'details'}
					<div class="space-y-4">
						<div>
							<label for="project-name" class="block text-sm font-medium mb-1">
								Project Name *
							</label>
							<input
								id="project-name"
								type="text"
								bind:value={projectData.name}
								class="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-input"
								placeholder="My Awesome Project"
							/>
						</div>

						<div>
							<label for="project-description" class="block text-sm font-medium mb-1">
								Description *
							</label>
							<textarea
								id="project-description"
								bind:value={projectData.description}
								rows="4"
								class="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-input"
								placeholder="Describe your project..."
							></textarea>
						</div>

						<div>
							<label for="project-tags" class="block text-sm font-medium mb-1">
								Tags (press Enter to add)
							</label>
							<input
								id="project-tags"
								type="text"
								bind:value={tagInput}
								onkeydown={handleAddTag}
								class="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-input"
								placeholder="Type a tag and press Enter"
							/>
							{#if projectData.tags.length > 0}
								<div class="flex flex-wrap gap-2 mt-2">
									{#each projectData.tags as tag, index}
										<span class="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded text-sm">
											{tag}
											<button
												onclick={() => removeTag(index)}
												class="text-muted-foreground hover:text-red-600"
											>
												<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M6 18L18 6M6 6l12 12"
													/>
												</svg>
											</button>
										</span>
									{/each}
								</div>
							{/if}
						</div>

						<div>
							<label for="project-image" class="block text-sm font-medium mb-1">
								Image URL
							</label>
							<input
								id="project-image"
								type="text"
								bind:value={projectData.imageUrl}
								class="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-input"
								placeholder="https://example.com/image.png"
							/>
						</div>

						<div>
							<label for="project-repo" class="block text-sm font-medium mb-1">
								Repository URL
							</label>
							<input
								id="project-repo"
								type="text"
								bind:value={projectData.repoUrl}
								class="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-input"
								placeholder="https://github.com/user/repo"
							/>
						</div>
					</div>
			{:else if currentStep === 'agents'}
				<div class="space-y-4">
					<!-- Pack Selection -->
					<PackSelectionGrid bind:selectedAgents />

					<p class="text-sm text-muted-foreground">
						Select individual agents to work on this project (optional)
					</p>

					<!-- Agent Selection -->
					<AgentSelectionGrid bind:selectedAgents />
				</div>
			{:else if currentStep === 'tools'}
				<div class="space-y-4">
					<p class="text-sm text-muted-foreground">
						Select MCP tools to enable for this project (optional)
					</p>

					<ToolSelectionList bind:selectedTools />
				</div>
				{:else if currentStep === 'review'}
					<div class="space-y-4">
						<div>
							<h4 class="font-medium mb-2">Project Details</h4>
							<div class="space-y-1 text-sm">
								<p>
									<span class="text-muted-foreground">Name:</span>
									{projectData.name}
								</p>
								<p>
									<span class="text-muted-foreground">Description:</span>
									{projectData.description}
								</p>
								{#if projectData.tags.length > 0}
									<p>
										<span class="text-muted-foreground">Tags:</span>
										{projectData.tags.join(', ')}
									</p>
								{/if}
								{#if projectData.imageUrl}
									<p>
										<span class="text-muted-foreground">Image:</span>
										{projectData.imageUrl}
									</p>
								{/if}
								{#if projectData.repoUrl}
									<p>
										<span class="text-muted-foreground">Repository:</span>
										{projectData.repoUrl}
									</p>
								{/if}
							</div>
						</div>

						{#if selectedAgents.size > 0}
							<div>
								<h4 class="font-medium mb-2">
									Selected Agents ({selectedAgents.size})
								</h4>
								<div class="flex flex-wrap gap-2">
									{#each Array.from(selectedAgents) as agent}
											<span class="inline-block px-2 py-1 bg-muted rounded text-sm">
												{agent.name}
											</span>
									{/each}
								</div>
							</div>
						{/if}

						{#if selectedTools.size > 0}
							<div>
								<h4 class="font-medium mb-2">
									Selected Tools ({selectedTools.size})
								</h4>
								<div class="flex flex-wrap gap-2">
									{#each Array.from(selectedTools) as tool}
											<span class="inline-block px-2 py-1 border border-border rounded text-sm">
												{tool.name}
											</span>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="flex-shrink-0 flex gap-3 px-6 py-4 border-t border-border">
				{#if currentStepIndex > 0}
					<button
						onclick={handleBack}
						disabled={creating}
						class="flex items-center gap-2 px-4 py-2 border border-border rounded-md hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M15 19l-7-7 7-7"
							/>
						</svg>
						Back
					</button>
				{/if}

				<div class="flex-1"></div>

				{#if currentStep === 'review'}
					<button
						onclick={handleCreate}
						disabled={creating}
						class={cn(
							'flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors',
							creating && 'opacity-50 cursor-not-allowed'
						)}
					>
						{#if creating}
							<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground"></div>
							Creating...
						{:else}
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M5 13l4 4L19 7"
								/>
							</svg>
							Create Project
						{/if}
					</button>
				{:else}
					<button
						onclick={handleNext}
						disabled={!canProceed()}
						class={cn(
							'flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors',
							!canProceed() && 'opacity-50 cursor-not-allowed'
						)}
					>
						Next
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 5l7 7-7 7"
							/>
						</svg>
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
