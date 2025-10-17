<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { NDKAgentDefinition } from '$lib/events/NDKAgentDefinition';
	import type { NDKAgentDefinition as AgentDefType } from '$lib/events/NDKAgentDefinition';
	import { cn } from '$lib/utils/cn';
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';
	import AIAssistedPromptEditor from './AIAssistedPromptEditor.svelte';

	interface Props {
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		forkAgent?: AgentDefType;
		cloneMode?: boolean;
	}

	let { open = $bindable(false), onOpenChange, forkAgent, cloneMode = false }: Props = $props();

	type WizardStep = 'basics' | 'prompt' | 'preview' | 'tools' | 'phases' | 'criteria';

	let currentStep = $state<WizardStep>('basics');
	let creating = $state(false);

	let name = $state('');
	let description = $state('');
	let role = $state('');
	let instructions = $state('');
	let useCriteria = $state('');
	let version = $state('1');
	let slug = $state('');
	let tools = $state<string[]>([]);
	let mcpServers = $state<string[]>([]);
	let phases = $state<Array<{ name: string; instructions: string }>>([]);
	let newTool = $state('');
	let showAIEditor = $state(false);

	$effect(() => {
		if (open && forkAgent) {
			if (cloneMode) {
				const baseName = forkAgent.name || 'Unnamed';
				const timestamp = Date.now().toString(36).slice(-6);
				const baseSlug =
					forkAgent.slug || baseName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

				name = `${baseName} (Copy)`;
				description = forkAgent.description || '';
				role = forkAgent.role || '';
				instructions = forkAgent.instructions || '';
				useCriteria = forkAgent.useCriteria?.join('\n') || '';
				version = '1';
				slug = `${baseSlug}-copy-${timestamp}`;
				tools = [...(forkAgent.tools || [])];
				mcpServers = [...(forkAgent.mcpServers || [])];
				phases = [...(forkAgent.phases || [])];
			} else {
				const existingVersion = parseInt(forkAgent.version || '1');
				const newVersion = isNaN(existingVersion) ? 2 : existingVersion + 1;

				name = forkAgent.name || 'Unnamed';
				description = forkAgent.description || '';
				role = forkAgent.role || '';
				instructions = forkAgent.instructions || '';
				useCriteria = forkAgent.useCriteria?.join('\n') || '';
				version = String(newVersion);
				slug = forkAgent.slug || '';
				tools = [...(forkAgent.tools || [])];
				mcpServers = [...(forkAgent.mcpServers || [])];
				phases = [...(forkAgent.phases || [])];
			}
		} else if (open && !forkAgent) {
			resetForm();
		}
		if (open) {
			currentStep = 'basics';
		}
	});

	function resetForm() {
		name = '';
		description = '';
		role = '';
		instructions = '';
		useCriteria = '';
		version = '1';
		slug = '';
		tools = [];
		mcpServers = [];
		phases = [];
		currentStep = 'basics';
	}

	function handleClose() {
		open = false;
		onOpenChange?.(false);
		resetForm();
	}

	async function handleCreate() {
		if (!ndk) {
			alert('NDK not initialized');
			return;
		}

		if (!name.trim()) {
			alert('Agent name is required');
			currentStep = 'basics';
			return;
		}

		if (!description.trim()) {
			alert('Agent description is required');
			currentStep = 'basics';
			return;
		}

		if (!instructions.trim()) {
			alert('System prompt is required');
			currentStep = 'prompt';
			return;
		}

		creating = true;
		try {
			const agent = new NDKAgentDefinition(ndk);
			agent.name = name;
			agent.description = description;
			agent.role = role;
			agent.instructions = instructions;

			const criteria = useCriteria
				.split('\n')
				.map((line) => line.trim())
				.filter((line) => line.length > 0);
			agent.useCriteria = criteria;
			agent.version = version || undefined;
			agent.slug = slug || undefined;
			agent.tools = tools;
			agent.mcpServers = mcpServers;
			agent.phases = phases;

			if (forkAgent && !cloneMode) {
				agent.tags.push(['e', forkAgent.id]);
			}
			if (forkAgent && cloneMode) {
				agent.tags.push(['cloned-from', forkAgent.id]);
			}

			await agent.publish();

			handleClose();
		} catch (error) {
			console.error('Failed to save agent:', error);
			alert(
				forkAgent
					? cloneMode
						? 'Failed to clone agent definition'
						: 'Failed to fork agent definition'
					: 'Failed to create agent definition'
			);
		} finally {
			creating = false;
		}
	}

	function canGoNext(): boolean {
		switch (currentStep) {
			case 'basics':
				return name.trim() !== '' && description.trim() !== '';
			case 'prompt':
				return instructions.trim().length > 0;
			default:
				return true;
		}
	}

	function goNext() {
		if (!canGoNext()) return;

		switch (currentStep) {
			case 'basics':
				currentStep = 'prompt';
				break;
			case 'prompt':
				currentStep = 'preview';
				break;
			case 'preview':
				currentStep = 'tools';
				break;
			case 'tools':
				currentStep = 'phases';
				break;
			case 'phases':
				currentStep = 'criteria';
				break;
			case 'criteria':
				handleCreate();
				break;
		}
	}

	function goBack() {
		switch (currentStep) {
			case 'prompt':
				currentStep = 'basics';
				break;
			case 'preview':
				currentStep = 'prompt';
				break;
			case 'tools':
				currentStep = 'preview';
				break;
			case 'phases':
				currentStep = 'tools';
				break;
			case 'criteria':
				currentStep = 'phases';
				break;
		}
	}

	function getStepTitle(): string {
		switch (currentStep) {
			case 'basics':
				return 'Basic Information';
			case 'prompt':
				return 'System Prompt';
			case 'preview':
				return 'Preview System Prompt';
			case 'tools':
				return 'Tools & MCP Servers';
			case 'phases':
				return 'Phase Definitions';
			case 'criteria':
				return 'Use Criteria & Version';
			default:
				return '';
		}
	}

	function getStepDescription(): string {
		switch (currentStep) {
			case 'basics':
				return 'Define the basic properties of your agent definition';
			case 'prompt':
				return "Write the system prompt that defines this agent's behavior and capabilities";
			case 'preview':
				return 'Review how your system prompt will be displayed';
			case 'tools':
				return 'Select tools and MCP servers this agent requires';
			case 'phases':
				return 'Define project phases for PM agents (optional)';
			case 'criteria':
				return 'Define when this agent should be used and set version';
			default:
				return '';
		}
	}

	function addTool() {
		if (newTool.trim() && !tools.includes(newTool.trim())) {
			tools = [...tools, newTool.trim()];
			newTool = '';
		}
	}

	function removeTool(tool: string) {
		tools = tools.filter((t) => t !== tool);
	}

	function addPhase() {
		phases = [...phases, { name: '', instructions: '' }];
	}

	function removePhase(index: number) {
		phases = phases.filter((_, i) => i !== index);
	}

	function renderMarkdown(content: string): string {
		const rawHtml = marked(content, { breaks: true });
		return DOMPurify.sanitize(rawHtml);
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
		onclick={handleClose}
		role="presentation"
		tabindex="0"
	>
		<div
			class="relative w-full max-w-3xl max-h-[90vh] bg-card rounded-lg shadow-xl flex flex-col"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
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
			<div class="px-6 pt-6 pb-4">
				<h2 class="text-xl font-semibold">
					{forkAgent ? (cloneMode ? 'Clone Agent Definition' : 'Fork Agent Definition') : 'Create Agent Definition'}
				</h2>
				<p class="text-sm text-muted-foreground mt-1">
					{getStepTitle()} - {getStepDescription()}
				</p>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto px-6 py-4">
				{#if currentStep === 'basics'}
					<div class="space-y-4">
						<div>
							<label for="name" class="block text-sm font-medium mb-1">Name *</label>
							<input
								id="name"
								type="text"
								bind:value={name}
								placeholder="My AI Assistant"
								class="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
						</div>

						<div>
							<label for="description" class="block text-sm font-medium mb-1"
								>Description *</label
							>
							<textarea
								id="description"
								bind:value={description}
								placeholder="Describe what this agent does..."
								rows="3"
								class="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							></textarea>
						</div>

						<div>
							<label for="role" class="block text-sm font-medium mb-1"
								>Role (optional)</label
							>
							<input
								id="role"
								type="text"
								bind:value={role}
								placeholder="e.g., assistant, developer, researcher"
								class="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
						</div>

						<div>
							<label for="slug" class="block text-sm font-medium mb-1"
								>Slug (optional)</label
							>
							<p class="text-sm text-muted-foreground mb-2">
								A unique identifier for this agent definition (e.g., "code-assistant", "research-helper")
							</p>
							<input
								id="slug"
								type="text"
								bind:value={slug}
								placeholder="e.g., my-assistant"
								pattern="^[a-z0-9-]+$"
								class="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
						</div>
					</div>
				{:else if currentStep === 'prompt'}
					<div class="space-y-4">
						<div>
							<div class="flex items-center justify-between mb-1">
								<label for="instructions" class="block text-sm font-medium"
									>System Prompt *</label
								>
								<button
									type="button"
									onclick={() => (showAIEditor = true)}
									class="inline-flex items-center gap-1 px-3 py-1 text-xs border border-border rounded-md hover:bg-accent transition-colors"
								>
									<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
										/>
									</svg>
									AI Edit
								</button>
							</div>
							<p class="text-sm text-muted-foreground mb-2">
								Define the agent's behavior, capabilities, and constraints. Use Markdown for formatting.
							</p>
							<textarea
								id="instructions"
								bind:value={instructions}
								rows="20"
								class="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
								placeholder="You are a helpful AI assistant specialized in...

## Core Responsibilities
- Assist users with...
- Provide accurate information about...

## Guidelines
1. Always maintain a professional tone
2. Provide clear and concise explanations

## Constraints
- Do not provide medical or legal advice
- Respect user privacy"
							></textarea>
						</div>
					</div>
				{:else if currentStep === 'preview'}
					<div class="space-y-4">
						<div class="border border-border rounded-lg p-6 bg-muted">
							<div class="prose prose-sm max-w-none">
								{#if instructions}
									{@html renderMarkdown(instructions)}
								{:else}
									<p class="text-muted-foreground italic">No system prompt provided</p>
								{/if}
							</div>
						</div>
						<div class="flex justify-center">
							<button
								onclick={() => (currentStep = 'prompt')}
								class="px-4 py-2 border border-border rounded-md hover:bg-accent transition-colors"
							>
								Edit System Prompt
							</button>
						</div>
					</div>
				{:else if currentStep === 'tools'}
					<div class="space-y-6">
						<div>
							<label class="block text-sm font-medium mb-1">Required Tools</label>
							<p class="text-sm text-muted-foreground mb-2">
								Specify which tools this agent needs access to. Users will be notified when adding this
								agent.
							</p>
							<div class="flex gap-2 mb-2">
								<input
									type="text"
									bind:value={newTool}
									onkeydown={(e) => e.key === 'Enter' && addTool()}
									placeholder="Add a tool name..."
									class="flex-1 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
								<button
									onclick={addTool}
									class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
								>
									Add
								</button>
							</div>
							<div class="flex flex-wrap gap-2">
								{#each tools as tool}
									<span
										class="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm"
									>
										{tool}
										<button onclick={() => removeTool(tool)} class="hover:text-blue-900">
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
						</div>
					</div>
				{:else if currentStep === 'phases'}
					<div class="space-y-4">
						<div>
							<label class="block text-sm font-medium mb-1">Phase Definitions</label>
							<p class="text-sm text-muted-foreground mb-2">
								Define project phases for PM agents. Each phase has a name and instructions.
							</p>

							<div class="space-y-3">
								{#each phases as phase, index}
									<div class="border border-border rounded-lg p-4 space-y-3">
										<div class="flex items-start gap-2">
											<div class="flex-1 space-y-3">
												<input
													type="text"
													bind:value={phase.name}
													placeholder="Phase name (e.g., Discovery, Development, Testing)"
													class="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
												/>
												<textarea
													bind:value={phase.instructions}
													placeholder="Instructions for this phase..."
													rows="3"
													class="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
												></textarea>
											</div>
											<button
												onclick={() => removePhase(index)}
												class="p-2 hover:bg-accent rounded-md transition-colors"
											>
												<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M6 18L18 6M6 6l12 12"
													/>
												</svg>
											</button>
										</div>
									</div>
								{/each}

								<button
									onclick={addPhase}
									class="w-full px-4 py-2 border border-border rounded-md hover:bg-accent transition-colors flex items-center justify-center gap-2"
								>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M12 4v16m8-8H4"
										/>
									</svg>
									Add Phase
								</button>

								{#if phases.length === 0}
									<div class="text-center py-6 border border-dashed border-border rounded-lg">
										<svg
											class="w-8 h-8 mx-auto text-muted-foreground mb-2"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M4 6h16M4 12h16M4 18h16"
											/>
										</svg>
										<p class="text-sm text-muted-foreground">
											No phases defined. Phases are optional and typically used for PM agents.
										</p>
									</div>
								{/if}
							</div>
						</div>
					</div>
				{:else if currentStep === 'criteria'}
					<div class="space-y-4">
						<div>
							<label for="use-criteria" class="block text-sm font-medium mb-1"
								>Use Criteria (optional)</label
							>
							<p class="text-sm text-muted-foreground mb-2">
								Define conditions when this agent should be used. Enter one criterion per line.
							</p>
							<textarea
								id="use-criteria"
								bind:value={useCriteria}
								rows="6"
								class="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								placeholder="User asks for help with coding
User needs research assistance
Task requires creative writing
Complex problem solving is needed"
							></textarea>
						</div>

						<div>
							<label for="version" class="block text-sm font-medium mb-1">Version</label>
							<p class="text-sm text-muted-foreground mb-2">
								Version number for this agent definition (use integers: 1, 2, 3, etc.)
							</p>
							<input
								id="version"
								type="number"
								bind:value={version}
								min="1"
								placeholder="1"
								class="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
						</div>
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="px-6 py-4 border-t border-border flex justify-between">
				<div>
					{#if currentStep !== 'basics'}
						<button
							onclick={goBack}
							disabled={creating}
							class="px-4 py-2 border border-border rounded-md hover:bg-accent transition-colors disabled:opacity-50"
						>
							<svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
							</svg>
							Back
						</button>
					{/if}
				</div>

				<div class="flex gap-2">
					<button
						onclick={handleClose}
						disabled={creating}
						class="px-4 py-2 border border-border rounded-md hover:bg-accent transition-colors disabled:opacity-50"
					>
						Cancel
					</button>

					<button
						onclick={goNext}
						disabled={creating || !canGoNext()}
						class={cn(
							'px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors',
							(creating || !canGoNext()) && 'opacity-50 cursor-not-allowed'
						)}
					>
						{#if creating}
							<svg
								class="w-4 h-4 inline mr-2 animate-spin"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
								/>
							</svg>
							{forkAgent ? (cloneMode ? 'Cloning...' : 'Forking...') : 'Creating...'}
						{:else if currentStep === 'criteria'}
							{forkAgent ? (cloneMode ? 'Clone' : 'Fork') : 'Create'}
						{:else}
							Next
							<svg class="w-4 h-4 inline ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
							</svg>
						{/if}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- AI-Assisted Prompt Editor -->
<AIAssistedPromptEditor
	bind:open={showAIEditor}
	currentPrompt={instructions}
	onUpdatePrompt={(newPrompt) => {
		instructions = newPrompt;
		showAIEditor = false;
	}}
/>
