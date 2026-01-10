<script lang="ts">
	import { aiConfigStore } from '$lib/stores/aiConfig.svelte';
	import { fetchImageModels, type ImageModelInfo } from '$lib/services/model-discovery';
	import { aiService } from '$lib/services/ai-service';
	import ImageProviderCard from './ImageProviderCard.svelte';
	import AddImageProviderDialog from './AddImageProviderDialog.svelte';

	let showAddDialog = $state(false);
	let availableModels = $state<ImageModelInfo[]>([]);
	let isLoadingModels = $state(false);

	// Test image generation state
	let testPrompt = $state('A cute robot painting a sunset');
	let isGenerating = $state(false);
	let generatedImage = $state<{ url?: string; base64?: string; error?: string } | null>(null);

	const config = $derived(aiConfigStore.config);
	const imageGenSettings = $derived(config.imageGenSettings);
	const isConfigured = $derived(!!imageGenSettings.model);

	async function loadModels() {
		isLoadingModels = true;
		try {
			// Use image gen API key if set, otherwise fall back to OpenAI API key
			const apiKey = imageGenSettings.apiKey || config.openAIApiKey;
			if (!apiKey) {
				console.warn('No API key available for fetching image models');
				availableModels = [];
				return;
			}
			availableModels = await fetchImageModels('openrouter', apiKey);
		} catch (error) {
			console.error('Failed to load image models:', error);
			availableModels = [];
		} finally {
			isLoadingModels = false;
		}
	}

	function handleToggle(enabled: boolean) {
		aiConfigStore.updateImageGenSettings({ enabled });
	}

	function handleConfigureClick() {
		loadModels();
		showAddDialog = true;
	}

	async function handleRefreshModels() {
		await loadModels();
	}

	async function handleTestGeneration() {
		if (!testPrompt.trim() || !isConfigured) return;

		isGenerating = true;
		generatedImage = null;

		try {
			const apiKey = imageGenSettings.apiKey || config.openAIApiKey;
			if (!apiKey) {
				generatedImage = { error: 'No API key configured. Add one in the Image Generation settings or OpenAI API Key field.' };
				return;
			}

			generatedImage = await aiService.generateImage(testPrompt, imageGenSettings, apiKey);
		} catch (error) {
			console.error('Test generation failed:', error);
			generatedImage = { error: error instanceof Error ? error.message : 'Generation failed' };
		} finally {
			isGenerating = false;
		}
	}
</script>

<!-- Image Generation Section -->
<div class="bg-card border border-border rounded-lg p-6">
	<div class="mb-4">
		<div class="flex items-center justify-between">
			<div>
				<h3 class="text-lg font-semibold text-foreground flex items-center gap-2">
					<span>🎨</span> Image Generation
				</h3>
				<p class="text-sm text-muted-foreground mt-1">Configure AI image generation settings</p>
			</div>
			<input
				type="checkbox"
				checked={imageGenSettings.enabled}
				onchange={(e) => handleToggle(e.currentTarget.checked)}
				class="w-4 h-4"
			/>
		</div>
	</div>

	{#if imageGenSettings.enabled}
		<div class="space-y-4">
			<ImageProviderCard onConfigure={handleConfigureClick} />

			<!-- Test Image Generation -->
			{#if isConfigured}
				<div class="border-t border-border pt-4 mt-4">
					<h4 class="text-sm font-medium text-foreground mb-3">Test Image Generation</h4>
					<div class="space-y-3">
						<div class="flex gap-2">
							<input
								type="text"
								bind:value={testPrompt}
								placeholder="Enter a prompt..."
								disabled={isGenerating}
								class="flex-1 px-3 py-2 border border-border rounded-md bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
							/>
							<button
								onclick={handleTestGeneration}
								disabled={isGenerating || !testPrompt.trim()}
								class="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
							>
								{#if isGenerating}
									<div class="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
									Generating...
								{:else}
									🎨 Generate
								{/if}
							</button>
						</div>

						<!-- Result Display -->
						{#if generatedImage}
							{#if generatedImage.error}
								<div class="p-3 bg-red-500/10 border border-red-500/30 rounded-md text-sm text-red-500">
									{generatedImage.error}
								</div>
							{:else if generatedImage.url || generatedImage.base64}
								<div class="rounded-lg overflow-hidden border border-border bg-muted">
									<img
										src={generatedImage.url || `data:image/png;base64,${generatedImage.base64}`}
										alt="Generated image"
										class="w-full max-h-96 object-contain"
									/>
								</div>
								<p class="text-xs text-muted-foreground">
									Generated with {imageGenSettings.model} at {imageGenSettings.size}
								</p>
							{/if}
						{/if}
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- Configuration Dialog -->
<AddImageProviderDialog
	bind:open={showAddDialog}
	{availableModels}
	onRefreshModels={handleRefreshModels}
	{isLoadingModels}
/>
