<script lang="ts">
	import { aiConfigStore } from '$lib/stores/aiConfig.svelte';
	import { generateText } from 'ai';
	import { createOpenAI } from '@ai-sdk/openai';
	import { createAnthropic } from '@ai-sdk/anthropic';
	import { createGoogleGenerativeAI } from '@ai-sdk/google';
	import { createOpenRouter } from '@openrouter/ai-sdk-provider';
	import { cn } from '$lib/utils/cn';

	interface Props {
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		currentPrompt: string;
		onUpdatePrompt: (prompt: string) => void;
	}

	let { open = $bindable(false), onOpenChange, currentPrompt, onUpdatePrompt }: Props = $props();

	let selectedConfigId = $state('');
	let instructions = $state('');
	let isGenerating = $state(false);
	let generatedPrompt = $state('');
	let showPreview = $state(false);
	let error = $state('');

	const llmConfigs = $derived(aiConfigStore.config.llmConfigs);

	function handleClose() {
		open = false;
		onOpenChange?.(false);
		resetState();
	}

	function resetState() {
		instructions = '';
		generatedPrompt = '';
		showPreview = false;
		error = '';
	}

	async function handleGenerate() {
		const selectedConfig = llmConfigs.find((c) => c.id === selectedConfigId);
		if (!selectedConfig) {
			error = 'Please select an LLM configuration';
			return;
		}

		if (!instructions.trim()) {
			error = 'Please enter modification instructions';
			return;
		}

		error = '';
		isGenerating = true;

		try {
			let provider: any;
			switch (selectedConfig.provider) {
				case 'openai':
					provider = createOpenAI({
						apiKey: selectedConfig.apiKey,
						baseURL: selectedConfig.baseUrl
					});
					break;
				case 'anthropic':
					provider = createAnthropic({
						apiKey: selectedConfig.apiKey,
						baseURL: selectedConfig.baseUrl
					});
					break;
				case 'google':
					provider = createGoogleGenerativeAI({
						apiKey: selectedConfig.apiKey,
						baseURL: selectedConfig.baseUrl
					});
					break;
				case 'openrouter':
					provider = createOpenRouter({
						apiKey: selectedConfig.apiKey,
						baseURL: selectedConfig.baseUrl
					});
					break;
				case 'custom':
					// For custom providers, use OpenAI-compatible API
					provider = createOpenAI({
						apiKey: selectedConfig.apiKey,
						baseURL: selectedConfig.baseUrl
					});
					break;
				default:
					throw new Error(`Unknown provider: ${selectedConfig.provider}`);
			}

			const model = selectedConfig.model || getDefaultModel(selectedConfig.provider);

			const metaPrompt = `You are an expert in writing system prompts for AI agents.
A user wants to modify an existing system prompt.

Here is the current system prompt:
---
${currentPrompt || 'No prompt provided yet - create a new one from scratch.'}
---

Here is the user's instruction for how to change it:
---
${instructions}
---

Please generate the new system prompt based on the user's instruction.
Respond ONLY with the full, rewritten system prompt text. Do not add any extra explanations or markdown code blocks.`;

			const result = await generateText({
				model: provider(model),
				prompt: metaPrompt,
				maxSteps: 1
			});

			generatedPrompt = result.text.trim();
			showPreview = true;
		} catch (err) {
			console.error('Failed to generate prompt:', err);
			error = 'Failed to generate improved prompt';
		} finally {
			isGenerating = false;
		}
	}

	function handleApply() {
		if (generatedPrompt) {
			onUpdatePrompt(generatedPrompt);
			handleClose();
		}
	}

	function getDefaultModel(provider: string): string {
		switch (provider) {
			case 'openai':
				return 'gpt-4o-mini';
			case 'anthropic':
				return 'claude-3-haiku-20240307';
			case 'google':
				return 'gemini-1.5-flash';
			case 'openrouter':
				return 'openai/gpt-4o-mini';
			case 'custom':
				return 'gpt-4o-mini'; // Assume OpenAI-compatible for custom
			default:
				return '';
		}
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
			class="relative w-full max-w-2xl max-h-[80vh] bg-card rounded-lg shadow-xl flex flex-col"
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
				<h2 class="text-xl font-semibold flex items-center gap-2">
					<svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
						/>
					</svg>
					AI-Assisted Prompt Editor
				</h2>
				<p class="text-sm text-muted-foreground mt-1">Use AI to refine and improve your system prompt</p>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto px-6 py-4 space-y-4">
				{#if !showPreview}
					<!-- LLM Configuration Selection -->
					<div>
						<label for="llm-config" class="block text-sm font-medium mb-1"
							>Select LLM Configuration</label
						>
						{#if llmConfigs.length > 0}
							<select
								id="llm-config"
								bind:value={selectedConfigId}
								class="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							>
								<option value="">Choose an LLM to assist you</option>
								{#each llmConfigs as config (config.id)}
									<option value={config.id}>
										{config.name} ({config.provider} - {config.model || 'default'})
									</option>
								{/each}
							</select>
						{:else}
							<div class="p-4 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
								<svg class="w-5 h-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
								<p class="text-sm text-red-800">
									No LLM configurations found. Please add one in the AI Settings first.
								</p>
							</div>
						{/if}
					</div>

					<!-- Modification Instructions -->
					<div>
						<label for="instructions" class="block text-sm font-medium mb-1"
							>Modification Instructions</label
						>
						<textarea
							id="instructions"
							bind:value={instructions}
							rows="8"
							class="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
							placeholder="Examples:
• Make the prompt more formal and professional
• Add instructions for the agent to be more concise
• Include guidelines about citing sources
• Make it friendlier and more conversational
• Add specific expertise in Python and machine learning"
						></textarea>
						<p class="text-xs text-muted-foreground mt-1">
							Describe how you want to modify the system prompt
						</p>
					</div>

					<!-- Current Prompt Preview -->
					{#if currentPrompt}
						<div>
							<label class="block text-sm font-medium mb-1">Current System Prompt</label>
							<div class="p-3 bg-muted rounded-lg max-h-32 overflow-y-auto">
								<p class="text-sm whitespace-pre-wrap">{currentPrompt}</p>
							</div>
						</div>
					{/if}

					<!-- Error Display -->
					{#if error}
						<div class="p-4 bg-red-50 border border-red-200 rounded-md">
							<p class="text-sm text-red-800">{error}</p>
						</div>
					{/if}
				{:else}
					<!-- Generated Prompt Preview -->
					<div>
						<label class="block text-sm font-medium mb-1">Generated System Prompt</label>
						<div class="border border-border rounded-lg p-4 bg-muted max-h-96 overflow-y-auto">
							<p class="whitespace-pre-wrap">{generatedPrompt}</p>
						</div>
					</div>

					<!-- Instructions Reminder -->
					<div>
						<label class="block text-sm font-medium mb-1">Your Instructions</label>
						<div class="p-3 bg-muted rounded-lg">
							<p class="text-sm italic">{instructions}</p>
						</div>
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="px-6 py-4 border-t border-border flex justify-end gap-2">
				{#if !showPreview}
					<button
						onclick={handleClose}
						class="px-4 py-2 border border-border rounded-md hover:bg-accent transition-colors"
					>
						Cancel
					</button>
					<button
						onclick={handleGenerate}
						disabled={!selectedConfigId || !instructions.trim() || isGenerating || llmConfigs.length === 0}
						class={cn(
							'px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors flex items-center gap-2',
							(!selectedConfigId || !instructions.trim() || isGenerating || llmConfigs.length === 0) &&
								'opacity-50 cursor-not-allowed'
						)}
					>
						{#if isGenerating}
							<svg
								class="w-4 h-4 animate-spin"
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
							Generating...
						{:else}
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
								/>
							</svg>
							Generate
						{/if}
					</button>
				{:else}
					<button
						onclick={() => (showPreview = false)}
						class="px-4 py-2 border border-border rounded-md hover:bg-accent transition-colors"
					>
						Back to Edit
					</button>
					<button
						onclick={handleClose}
						class="px-4 py-2 border border-border rounded-md hover:bg-accent transition-colors"
					>
						Cancel
					</button>
					<button
						onclick={handleApply}
						class="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
					>
						Apply Changes
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
