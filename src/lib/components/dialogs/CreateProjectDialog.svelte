<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { NDKProject } from '$lib/events/NDKProject';
	import { NDKAgentDefinition } from '$lib/events/NDKAgentDefinition';
	import { NDKMCPTool } from '$lib/events/NDKMCPTool';
	import { cn } from '$lib/utils/cn';
	import AgentDefinitionCard from '$lib/components/agents/AgentDefinitionCard.svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';

	interface Props {
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
	}

	let { open = $bindable(false), onOpenChange }: Props = $props();

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

	// Selected items
	let selectedAgents: SvelteSet<string> = new SvelteSet();
	let selectedTools: SvelteSet<string> = new SvelteSet();

	// Available items
	let availableAgents = $state<NDKAgentDefinition[]>([]);
	let availableTools = $state<NDKMCPTool[]>([]);
	let isLoadingAgents = $state(true);
	let isLoadingTools = $state(true);

	// Tag input
	let tagInput = $state('');

	const steps: Step[] = ['details', 'agents', 'tools', 'review'];
	const currentStepIndex = $derived(steps.indexOf(currentStep));

	// Reset form when dialog opens/closes
	$effect(() => {
		if (open) {
			resetForm();
			fetchAgents();
			fetchTools();
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
		onOpenChange?.(false);
	}

	async function fetchAgents() {
		if (!ndk) return;

		isLoadingAgents = true;
		try {
			const events = await ndk.fetchEvents({
				kinds: [NDKAgentDefinition.kind],
				limit: 100
			});

			const allAgents = Array.from(events).map((event) => {
				return new NDKAgentDefinition(ndk, event.rawEvent());
			});

			// Group agents by slug (d tag) or name if no slug
			const agentGroups = new SvelteMap<string, NDKAgentDefinition[]>();

			allAgents.forEach((agent) => {
				const groupKey = agent.slug || agent.name || agent.id;

				if (!agentGroups.has(groupKey)) {
					agentGroups.set(groupKey, []);
				}
				const group = agentGroups.get(groupKey);
				if (group) {
					group.push(agent);
				}
			});

			// For each group, keep only the latest version
			const latestAgents: NDKAgentDefinition[] = [];

			agentGroups.forEach((groupAgents) => {
				if (groupAgents.length === 1) {
					latestAgents.push(groupAgents[0]);
				} else {
					// Sort by created_at timestamp (newest first) and version number
					const sorted = groupAgents.sort((a, b) => {
						const timeA = a.created_at || 0;
						const timeB = b.created_at || 0;
						if (timeA !== timeB) {
							return timeB - timeA;
						}

						const versionA = parseInt(a.version || '0');
						const versionB = parseInt(b.version || '0');
						return versionB - versionA;
					});

					latestAgents.push(sorted[0]);
				}
			});

			availableAgents = latestAgents;
		} catch (error) {
			console.error('Failed to fetch agents:', error);
			alert('Failed to load agents');
		} finally {
			isLoadingAgents = false;
		}
	}

	async function fetchTools() {
		if (!ndk) return;

		isLoadingTools = true;
		try {
			const events = await ndk.fetchEvents({
				kinds: [NDKMCPTool.kind],
				limit: 100
			});

			const tools = Array.from(events).map((event) => {
				return new NDKMCPTool(ndk, event.rawEvent());
			});

			availableTools = tools;
		} catch (error) {
			console.error('Failed to fetch tools:', error);
			alert('Failed to load MCP tools');
		} finally {
			isLoadingTools = false;
		}
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

	function toggleAgent(agentId: string) {
		const newSelected = new SvelteSet(selectedAgents);
		if (newSelected.has(agentId)) {
			newSelected.delete(agentId);
		} else {
			newSelected.add(agentId);
		}
		selectedAgents = newSelected;
	}

	function toggleTool(toolId: string) {
		const newSelected = new SvelteSet(selectedTools);
		if (newSelected.has(toolId)) {
			newSelected.delete(toolId);
		} else {
			newSelected.add(toolId);
		}
		selectedTools = newSelected;
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
			selectedAgents.forEach((agentId) => {
				project.addAgent(agentId);

				// Also add the MCP servers required by these agents
				const agent = availableAgents.find((a) => a.id === agentId);
				if (agent?.mcpServers) {
					agent.mcpServers.forEach((mcpId) => {
						project.addMCPTool(mcpId);
					});
				}
			});

			// Add selected tools
			selectedTools.forEach((toolId) => {
				project.addMCPTool(toolId);
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
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
		onclick={handleClose}
		onkeydown={handleKeydown}
		role="presentation"
		tabindex="0"
	>
		<div
			class="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-zinc-900 rounded-lg shadow-xl flex flex-col"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
		>
			<!-- Close Button -->
			<button
				onclick={handleClose}
				class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 z-10"
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
			<div class="flex-shrink-0 px-6 pt-6 pb-4 border-b border-gray-200 dark:border-zinc-700">
				<h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Create New Project</h2>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
					Step {currentStepIndex + 1} of {steps.length}: {getStepTitle(currentStep)}
				</p>
			</div>

			<!-- Step indicators -->
			<div class="flex-shrink-0 flex items-center justify-center gap-2 py-4 px-6">
				{#each steps as step, index}
					<div
						class={cn(
							'flex items-center gap-2',
							index <= currentStepIndex ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'
						)}
					>
						<div
							class={cn(
								'flex h-8 w-8 items-center justify-center rounded-full border-2',
								index <= currentStepIndex
									? 'border-blue-600 dark:border-blue-400 bg-blue-600 dark:bg-blue-400 text-white'
									: 'border-gray-300 dark:border-zinc-600'
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
									index < currentStepIndex ? 'bg-blue-600 dark:bg-blue-400' : 'bg-gray-300 dark:bg-zinc-600'
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
							<label for="project-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
								Project Name *
							</label>
							<input
								id="project-name"
								type="text"
								bind:value={projectData.name}
								class="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100"
								placeholder="My Awesome Project"
							/>
						</div>

						<div>
							<label for="project-description" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
								Description *
							</label>
							<textarea
								id="project-description"
								bind:value={projectData.description}
								rows="4"
								class="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100"
								placeholder="Describe your project..."
							></textarea>
						</div>

						<div>
							<label for="project-tags" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
								Tags (press Enter to add)
							</label>
							<input
								id="project-tags"
								type="text"
								bind:value={tagInput}
								onkeydown={handleAddTag}
								class="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100"
								placeholder="Type a tag and press Enter"
							/>
							{#if projectData.tags.length > 0}
								<div class="flex flex-wrap gap-2 mt-2">
									{#each projectData.tags as tag, index}
										<span class="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded text-sm">
											{tag}
											<button
												onclick={() => removeTag(index)}
												class="text-gray-500 hover:text-red-600 dark:hover:text-red-400"
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
							<label for="project-image" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
								Image URL
							</label>
							<input
								id="project-image"
								type="text"
								bind:value={projectData.imageUrl}
								class="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100"
								placeholder="https://example.com/image.png"
							/>
						</div>

						<div>
							<label for="project-repo" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
								Repository URL
							</label>
							<input
								id="project-repo"
								type="text"
								bind:value={projectData.repoUrl}
								class="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100"
								placeholder="https://github.com/user/repo"
							/>
						</div>
					</div>
				{:else if currentStep === 'agents'}
					<div class="space-y-4">
						<p class="text-sm text-gray-600 dark:text-gray-400">
							Select individual agents to work on this project (optional)
						</p>

						<div class="border border-gray-200 dark:border-zinc-700 rounded-lg p-4">
							{#if isLoadingAgents}
								<div class="flex items-center justify-center py-8">
									<div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
								</div>
							{:else if availableAgents.length === 0}
								<p class="text-center text-gray-500 dark:text-gray-400 py-8">
									No agents available
								</p>
							{:else}
								<div class="grid gap-4 md:grid-cols-2">
									{#each availableAgents as agent (agent.id)}
										<div
											class={cn(
												'relative rounded-lg transition-all',
												selectedAgents.has(agent.id) && 'ring-2 ring-blue-600 dark:ring-blue-400'
											)}
										>
											<AgentDefinitionCard {agent} onclick={() => toggleAgent(agent.id)} />
											{#if selectedAgents.has(agent.id)}
												<div class="absolute top-2 right-2 w-6 h-6 bg-blue-600 dark:bg-blue-400 rounded-full flex items-center justify-center">
													<svg
														class="w-4 h-4 text-white"
														fill="none"
														viewBox="0 0 24 24"
														stroke="currentColor"
														stroke-width="3"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															d="M5 13l4 4L19 7"
														/>
													</svg>
												</div>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				{:else if currentStep === 'tools'}
					<div class="space-y-4">
						<p class="text-sm text-gray-600 dark:text-gray-400">
							Select MCP tools to enable for this project (optional)
						</p>

						<div class="border border-gray-200 dark:border-zinc-700 rounded-lg p-4">
							{#if isLoadingTools}
								<div class="flex items-center justify-center py-8">
									<div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
								</div>
							{:else if availableTools.length === 0}
								<p class="text-center text-gray-500 dark:text-gray-400 py-8">
									No MCP tools available
								</p>
							{:else}
								<div class="space-y-2">
									{#each availableTools as tool (tool.id)}
										<button
											onclick={() => toggleTool(tool.id)}
											class={cn(
												'w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left',
												selectedTools.has(tool.id)
													? 'bg-blue-50 dark:bg-blue-900/20 border-blue-600 dark:border-blue-400'
													: 'border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800'
											)}
										>
											<div class="w-10 h-10 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
												<svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d={getStepIcon('tools')}
													/>
												</svg>
											</div>

											<div class="flex-1 min-w-0">
												<p class="font-medium text-gray-900 dark:text-gray-100">
													{tool.name || 'Unnamed Tool'}
												</p>
												<p class="text-sm text-gray-600 dark:text-gray-400 truncate">
													{tool.description || 'No description'}
												</p>
												<code class="text-xs bg-gray-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-gray-700 dark:text-gray-300">
													{tool.command}
												</code>
											</div>

											{#if selectedTools.has(tool.id)}
												<svg class="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
				{:else if currentStep === 'review'}
					<div class="space-y-4">
						<div>
							<h4 class="font-medium text-gray-900 dark:text-gray-100 mb-2">Project Details</h4>
							<div class="space-y-1 text-sm">
								<p class="text-gray-700 dark:text-gray-300">
									<span class="text-gray-500 dark:text-gray-400">Name:</span>
									{projectData.name}
								</p>
								<p class="text-gray-700 dark:text-gray-300">
									<span class="text-gray-500 dark:text-gray-400">Description:</span>
									{projectData.description}
								</p>
								{#if projectData.tags.length > 0}
									<p class="text-gray-700 dark:text-gray-300">
										<span class="text-gray-500 dark:text-gray-400">Tags:</span>
										{projectData.tags.join(', ')}
									</p>
								{/if}
								{#if projectData.imageUrl}
									<p class="text-gray-700 dark:text-gray-300">
										<span class="text-gray-500 dark:text-gray-400">Image:</span>
										{projectData.imageUrl}
									</p>
								{/if}
								{#if projectData.repoUrl}
									<p class="text-gray-700 dark:text-gray-300">
										<span class="text-gray-500 dark:text-gray-400">Repository:</span>
										{projectData.repoUrl}
									</p>
								{/if}
							</div>
						</div>

						{#if selectedAgents.size > 0}
							<div>
								<h4 class="font-medium text-gray-900 dark:text-gray-100 mb-2">
									Selected Agents ({selectedAgents.size})
								</h4>
								<div class="flex flex-wrap gap-2">
									{#each Array.from(selectedAgents) as agentId}
										{@const agent = availableAgents.find((a) => a.id === agentId)}
										{#if agent}
											<span class="inline-block px-2 py-1 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded text-sm">
												{agent.name}
											</span>
										{/if}
									{/each}
								</div>
							</div>
						{/if}

						{#if selectedTools.size > 0}
							<div>
								<h4 class="font-medium text-gray-900 dark:text-gray-100 mb-2">
									Selected Tools ({selectedTools.size})
								</h4>
								<div class="flex flex-wrap gap-2">
									{#each Array.from(selectedTools) as toolId}
										{@const tool = availableTools.find((t) => t.id === toolId)}
										{#if tool}
											<span class="inline-block px-2 py-1 border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 rounded text-sm">
												{tool.name}
											</span>
										{/if}
									{/each}
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="flex-shrink-0 flex gap-3 px-6 py-4 border-t border-gray-200 dark:border-zinc-700">
				{#if currentStepIndex > 0}
					<button
						onclick={handleBack}
						disabled={creating}
						class="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
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
							'flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors',
							creating && 'opacity-50 cursor-not-allowed'
						)}
					>
						{#if creating}
							<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
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
							'flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors',
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
