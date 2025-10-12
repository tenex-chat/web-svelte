<script lang="ts">
	import { aiConfigStore, type LLMConfig, type AIProvider } from '$lib/stores/aiConfig.svelte';
	import { cn } from '$lib/utils/cn';
	import { fetchModels, type ModelInfo } from '$lib/services/model-discovery';

	interface Props {
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
	}

	let { open = $bindable(false), onOpenChange }: Props = $props();

	let name = $state('');
	let provider = $state<AIProvider>('openai');
	let model = $state('');
	let apiKey = $state('');
	let baseUrl = $state('');
	let saving = $state(false);
	let fetchingModels = $state(false);
	let availableModels = $state<ModelInfo[]>([]);
	let fetchError = $state('');

	const providerOptions = [
		{ value: 'openai', label: 'OpenAI', defaultModel: 'gpt-4o-mini' },
		{ value: 'anthropic', label: 'Anthropic', defaultModel: 'claude-3-5-sonnet-20241022' },
		{ value: 'google', label: 'Google', defaultModel: 'gemini-1.5-flash' },
		{ value: 'openrouter', label: 'OpenRouter', defaultModel: 'openai/gpt-4o-mini' },
		{ value: 'custom', label: 'Custom', defaultModel: '' }
	];

	function handleClose() {
		open = false;
		onOpenChange?.(false);
		name = '';
		provider = 'openai';
		model = '';
		apiKey = '';
		baseUrl = '';
		availableModels = [];
		fetchError = '';
	}

	function handleProviderChange(newProvider: AIProvider) {
		provider = newProvider;
		const option = providerOptions.find((p) => p.value === newProvider);
		if (option) {
			model = option.defaultModel;
		}
		// Clear fetched models when provider changes
		availableModels = [];
		fetchError = '';
	}

	async function handleFetchModels() {
		if (!apiKey.trim()) {
			fetchError = 'Please enter an API key first';
			return;
		}

		fetchingModels = true;
		fetchError = '';

		try {
			const models = await fetchModels(provider, apiKey, baseUrl || undefined);
			availableModels = models;

			// Set first model as default if current model is empty
			if (!model && models.length > 0) {
				model = models[0].id;
			}
		} catch (error) {
			console.error('Failed to fetch models:', error);
			fetchError = error instanceof Error ? error.message : 'Failed to fetch models';
			availableModels = [];
		} finally {
			fetchingModels = false;
		}
	}

	async function handleSave() {
		if (!name.trim() || !model.trim() || !apiKey.trim()) {
			alert('Please fill in all required fields');
			return;
		}

		if (provider === 'custom' && !baseUrl.trim()) {
			alert('Please provide a base URL for custom provider');
			return;
		}

		saving = true;

		try {
			const config: LLMConfig = {
				id: `${provider}-${Date.now()}`,
				name: name.trim(),
				provider,
				model: model.trim(),
				apiKey: apiKey.trim(),
				baseUrl: provider === 'custom' ? baseUrl.trim() : undefined
			};

			aiConfigStore.addLLMConfig(config);

			handleClose();
		} catch (error) {
			console.error('Failed to save config:', error);
			alert('Failed to save configuration. Please try again.');
		} finally {
			saving = false;
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
			<h2 class="text-xl font-semibold text-gray-900 mb-4">Add LLM Configuration</h2>

			<!-- Form -->
			<div class="space-y-4">
				<div>
					<label for="config-name" class="block text-sm font-medium text-gray-700 mb-1">
						Configuration Name
					</label>
					<input
						id="config-name"
						type="text"
						bind:value={name}
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
						placeholder="My OpenAI Key"
					/>
				</div>

				<div>
					<label for="provider" class="block text-sm font-medium text-gray-700 mb-1">
						Provider
					</label>
					<select
						id="provider"
						bind:value={provider}
						onchange={(e) => handleProviderChange(e.currentTarget.value as AIProvider)}
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						{#each providerOptions as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>

				<div>
					<div class="flex items-center justify-between mb-1">
						<label for="model" class="block text-sm font-medium text-gray-700"> Model </label>
						<button
							type="button"
							onclick={handleFetchModels}
							disabled={!apiKey.trim() || fetchingModels}
							class={cn(
								'text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 transition-colors',
								(!apiKey.trim() || fetchingModels) && 'opacity-50 cursor-not-allowed'
							)}
						>
							{fetchingModels ? '🔄 Fetching...' : '🔍 Fetch Available Models'}
						</button>
					</div>

					{#if availableModels.length > 0}
						<select
							id="model"
							bind:value={model}
							class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
						>
							<option value="">Select a model</option>
							{#each availableModels as modelInfo (modelInfo.id)}
								<option value={modelInfo.id}>
									{modelInfo.name || modelInfo.id}
									{#if modelInfo.contextLength}
										({(modelInfo.contextLength / 1000).toFixed(0)}k context)
									{/if}
								</option>
							{/each}
						</select>
						<p class="text-xs text-gray-500 mt-1">
							Found {availableModels.length} models. You can also enter a model name manually below.
						</p>
						<input
							type="text"
							bind:value={model}
							class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mt-2"
							placeholder="Or enter model name manually"
						/>
					{:else}
						<input
							id="model"
							type="text"
							bind:value={model}
							class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="gpt-4"
						/>
						<p class="text-xs text-gray-500 mt-1">
							{#if provider === 'openai'}
								Examples: gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo
							{:else if provider === 'anthropic'}
								Examples: claude-3-5-sonnet-20241022, claude-3-opus-20240229
							{:else if provider === 'google'}
								Examples: gemini-1.5-pro, gemini-1.5-flash, gemini-pro
							{:else if provider === 'openrouter'}
								Examples: openai/gpt-4o, anthropic/claude-3.5-sonnet
							{:else}
								Enter your custom model identifier
							{/if}
						</p>
					{/if}

					{#if fetchError}
						<p class="text-xs text-red-600 mt-1">{fetchError}</p>
					{/if}
				</div>

				<div>
					<label for="api-key" class="block text-sm font-medium text-gray-700 mb-1">
						API Key
					</label>
					<input
						id="api-key"
						type="password"
						bind:value={apiKey}
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
						placeholder="sk-..."
					/>
				</div>

				{#if provider === 'custom'}
					<div>
						<label for="base-url" class="block text-sm font-medium text-gray-700 mb-1">
							Base URL
						</label>
						<input
							id="base-url"
							type="text"
							bind:value={baseUrl}
							class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="https://api.your-llm-provider.com"
						/>
					</div>
				{/if}
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
					onclick={handleSave}
					disabled={!name.trim() || !model.trim() || !apiKey.trim() || saving}
					class={cn(
						'flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors',
						(!name.trim() || !model.trim() || !apiKey.trim() || saving) &&
							'opacity-50 cursor-not-allowed'
					)}
				>
					{saving ? 'Saving...' : 'Add Configuration'}
				</button>
			</div>
		</div>
	</div>
{/if}
