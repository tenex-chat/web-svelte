<script lang="ts">
	import { aiConfigStore } from '$lib/stores/aiConfig.svelte';
	import { cn } from '$lib/utils/cn';
	import type { ImageModelInfo } from '$lib/services/model-discovery';

	interface Props {
		open?: boolean;
		availableModels?: ImageModelInfo[];
		onRefreshModels?: () => Promise<void>;
		isLoadingModels?: boolean;
	}

	let {
		open = $bindable(false),
		availableModels = [],
		onRefreshModels,
		isLoadingModels = false
	}: Props = $props();

	const config = $derived(aiConfigStore.config);
	const imageGenSettings = $derived(config.imageGenSettings);

	// Form state
	let modelSearch = $state('');
	let selectedModel = $state('');
	let selectedSize = $state('');
	let apiKeyOverride = $state('');
	let showModelDropdown = $state(false);

	// Standard dimension options (used as fallback and for common sizes)
	const standardSizes = ['1024x1024', '1024x1792', '1792x1024'];

	// Get available sizes for the selected model
	const availableSizes = $derived(() => {
		if (selectedModel) {
			const model = availableModels.find((m) => m.id === selectedModel);
			if (model?.capabilities?.dimensions && model.capabilities.dimensions.length > 0) {
				return model.capabilities.dimensions;
			}
		}
		return standardSizes;
	});

	// Filter models based on search
	const filteredModels = $derived(() => {
		if (!modelSearch.trim()) {
			return availableModels;
		}
		const query = modelSearch.toLowerCase();
		return availableModels.filter(
			(model) =>
				model.id.toLowerCase().includes(query) ||
				model.name?.toLowerCase().includes(query) ||
				model.description?.toLowerCase().includes(query)
		);
	});

	// Initialize form with current settings when dialog opens
	$effect(() => {
		if (open) {
			selectedModel = imageGenSettings.model;
			selectedSize = imageGenSettings.size;
			apiKeyOverride = imageGenSettings.apiKey || '';
			modelSearch = '';
			showModelDropdown = false;
		}
	});

	function handleClose() {
		open = false;
		showModelDropdown = false;
	}

	function handleSelectModel(modelId: string) {
		selectedModel = modelId;
		modelSearch = '';
		showModelDropdown = false;

		// Update size to first available for new model if current size isn't supported
		const model = availableModels.find((m) => m.id === modelId);
		if (model?.capabilities?.dimensions && model.capabilities.dimensions.length > 0) {
			if (!model.capabilities.dimensions.includes(selectedSize)) {
				selectedSize = model.capabilities.dimensions[0];
			}
		}
	}

	function handleSave() {
		const updates: Parameters<typeof aiConfigStore.updateImageGenSettings>[0] = {
			model: selectedModel,
			size: selectedSize
		};

		// Only update API key if provided (don't clear existing key with empty string)
		if (apiKeyOverride.trim()) {
			updates.apiKey = apiKeyOverride.trim();
		}

		aiConfigStore.updateImageGenSettings(updates);
		handleClose();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			handleClose();
		}
	}

	function handleOverlayClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			handleClose();
		}
	}

	// Get display name for model
	function getModelDisplayName(model: ImageModelInfo): string {
		return model.name || model.id;
	}

	// Get selected model display name
	const selectedModelDisplay = $derived(() => {
		if (!selectedModel) return 'Select a model...';
		const model = availableModels.find((m) => m.id === selectedModel);
		return model ? getModelDisplayName(model) : selectedModel;
	});
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-overlay/60 backdrop-blur-sm"
		onclick={handleOverlayClick}
		onkeydown={handleKeydown}
		role="presentation"
		tabindex="0"
	>
		<div
			class="relative w-full max-w-lg bg-card rounded-xl shadow-2xl border border-border/50 overflow-hidden"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
		>
			<!-- Header -->
			<div
				class="bg-gradient-to-r from-purple-600/10 to-pink-600/10 border-b border-border/50 px-6 py-5"
			>
				<button
					onclick={handleClose}
					class="absolute top-5 right-5 text-muted-foreground hover:text-foreground transition-colors"
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

				<h2 class="text-xl font-bold text-foreground mb-1">Configure Image Generation</h2>
				<p class="text-sm text-muted-foreground">Set up your AI image generation preferences</p>
			</div>

			<!-- Content -->
			<div class="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
				<!-- Provider Selector -->
				<div class="space-y-2">
					<label for="provider-select" class="block text-sm font-medium text-foreground">
						Provider
					</label>
					<select
						id="provider-select"
						disabled
						class="w-full px-3 py-2 border border-border rounded-md bg-muted text-muted-foreground cursor-not-allowed"
					>
						<option value="openrouter">OpenRouter</option>
					</select>
					<p class="text-xs text-muted-foreground">
						Currently only OpenRouter is supported for image generation
					</p>
				</div>

				<!-- Model Search with Autocomplete -->
				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<label for="model-search" class="block text-sm font-medium text-foreground">
							Model
						</label>
						{#if onRefreshModels}
							<button
								type="button"
								onclick={onRefreshModels}
								disabled={isLoadingModels}
								class="text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
							>
								{#if isLoadingModels}
									<div
										class="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"
									></div>
								{:else}
									<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
										/>
									</svg>
								{/if}
								Refresh Models
							</button>
						{/if}
					</div>

					<div class="relative">
						<input
							id="model-search"
							type="text"
							bind:value={modelSearch}
							onfocus={() => (showModelDropdown = true)}
							onblur={() => {
								// If user typed a custom model ID, use it
								if (modelSearch.trim() && !availableModels.some(m => m.id === modelSearch.trim())) {
									selectedModel = modelSearch.trim();
								}
							}}
							oninput={() => {
								// Update selectedModel as user types to allow custom model IDs
								if (modelSearch.trim()) {
									selectedModel = modelSearch.trim();
								}
							}}
							placeholder={selectedModelDisplay()}
							class="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
						/>

						<!-- Current selection indicator -->
						{#if selectedModel && !modelSearch}
							<div class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
								<span class="text-foreground">{selectedModelDisplay()}</span>
							</div>
						{/if}

						<!-- Dropdown -->
						{#if showModelDropdown && filteredModels().length > 0}
							<div
								class="absolute z-10 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-48 overflow-y-auto"
							>
								{#each filteredModels() as model (model.id)}
									<button
										type="button"
										onclick={() => handleSelectModel(model.id)}
										class={cn(
											'w-full px-3 py-2 text-left hover:bg-muted transition-colors flex flex-col',
											selectedModel === model.id && 'bg-primary/10 text-primary'
										)}
									>
										<span class="font-medium text-sm">{getModelDisplayName(model)}</span>
										{#if model.description}
											<span class="text-xs text-muted-foreground line-clamp-1"
												>{model.description}</span
											>
										{/if}
									</button>
								{/each}
							</div>
						{:else if showModelDropdown && modelSearch && filteredModels().length === 0}
							<div
								class="absolute z-10 w-full mt-1 bg-card border border-border rounded-md shadow-lg p-3"
							>
								<p class="text-sm text-muted-foreground text-center">
									No models found. You can still use "{modelSearch}" as a custom model.
								</p>
							</div>
						{:else if showModelDropdown && availableModels.length === 0}
							<div
								class="absolute z-10 w-full mt-1 bg-card border border-border rounded-md shadow-lg p-3"
							>
								<p class="text-sm text-muted-foreground text-center">
									{isLoadingModels ? 'Loading models...' : 'Type a model ID (e.g. "google/gemini-2.0-flash-exp-image-generation") or click "Refresh Models" to load available models.'}
								</p>
							</div>
						{/if}
					</div>

					<!-- Close dropdown when clicking outside -->
					{#if showModelDropdown}
						<button
							type="button"
							class="fixed inset-0 z-0"
							onclick={() => (showModelDropdown = false)}
							aria-label="Close dropdown"
						></button>
					{/if}
				</div>

				<!-- Image Size Selector -->
				<div class="space-y-2">
					<label for="size-select" class="block text-sm font-medium text-foreground">
						Image Size
					</label>
					<select
						id="size-select"
						bind:value={selectedSize}
						class="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
					>
						{#each availableSizes() as size}
							<option value={size}>{size}</option>
						{/each}
					</select>
					<p class="text-xs text-muted-foreground">
						{#if selectedSize === '1024x1024'}
							Square format - best for general purpose images
						{:else if selectedSize === '1024x1792' || selectedSize === '896x1152'}
							Portrait format - best for vertical compositions
						{:else if selectedSize === '1792x1024' || selectedSize === '1152x896'}
							Landscape format - best for horizontal compositions
						{:else}
							Select the output dimensions for generated images
						{/if}
					</p>
				</div>

				<!-- API Key Override -->
				<div class="space-y-2">
					<label for="api-key" class="block text-sm font-medium text-foreground">
						API Key Override
						<span class="text-muted-foreground font-normal">(optional)</span>
					</label>
					<input
						id="api-key"
						type="password"
						bind:value={apiKeyOverride}
						placeholder="Leave empty to use default OpenAI key"
						class="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
					/>
					<p class="text-xs text-muted-foreground">
						Provide a specific API key for image generation, or leave empty to use your OpenAI API
						key
					</p>
				</div>
			</div>

			<!-- Footer -->
			<div class="border-t border-border/50 px-6 py-4 bg-muted/20">
				<div class="flex gap-3">
					<button
						onclick={handleClose}
						class="flex-1 px-4 py-2.5 border border-border rounded-lg hover:bg-muted text-foreground font-medium transition-colors"
					>
						Cancel
					</button>
					<button
						onclick={handleSave}
						disabled={!selectedModel}
						class={cn(
							'flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium transition-colors',
							!selectedModel && 'opacity-50 cursor-not-allowed',
							selectedModel && 'hover:bg-primary/90'
						)}
					>
						Save Configuration
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
