<script lang="ts">
	import { aiConfigStore } from '$lib/stores/aiConfig.svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		onConfigure?: () => void;
	}

	let { onConfigure }: Props = $props();

	const config = $derived(aiConfigStore.config);
	const imageGenSettings = $derived(config.imageGenSettings);

	// Get display name for provider
	function getProviderDisplayName(provider: string): string {
		switch (provider) {
			case 'openrouter':
				return 'OpenRouter';
			case 'openai':
				return 'OpenAI';
			case 'custom':
				return 'Custom';
			default:
				return provider;
		}
	}

	// Get a formatted model name
	function getModelDisplayName(model: string): string {
		if (!model) return 'Not configured';
		// Extract just the model name part after the provider prefix
		const parts = model.split('/');
		return parts.length > 1 ? parts[1] : model;
	}

	// Check if model is configured
	const isConfigured = $derived(!!imageGenSettings.model);
</script>

<div
	class={cn(
		'flex items-center justify-between p-4 border rounded-lg',
		isConfigured ? 'border-primary bg-primary/10' : 'border-border bg-muted/50'
	)}
>
	<div class="flex items-center gap-3">
		<div class={cn(
			'w-10 h-10 rounded-lg flex items-center justify-center',
			isConfigured ? 'bg-gradient-to-br from-purple-500 to-pink-500' : 'bg-muted'
		)}>
			<span class={cn('text-lg', isConfigured ? 'text-white' : 'text-muted-foreground')}>🖼️</span>
		</div>
		<div>
			<div class="font-medium text-foreground">{getProviderDisplayName(imageGenSettings.provider)}</div>
			<div class="flex items-center gap-2 text-sm text-muted-foreground">
				{#if isConfigured}
					<span>{getModelDisplayName(imageGenSettings.model)}</span>
					<span>•</span>
					<span>{imageGenSettings.size}</span>
					{#if imageGenSettings.apiKey}
						<span>•</span>
						<span>•••••{imageGenSettings.apiKey.slice(-4)}</span>
					{/if}
				{:else}
					<span class="text-amber-500">No model selected - click Configure to set up</span>
				{/if}
			</div>
		</div>
	</div>
	<div class="flex items-center gap-2">
		{#if isConfigured}
			<div class="flex items-center gap-1 px-2 py-1 bg-primary/10 rounded text-xs text-primary">
				✓ Active
			</div>
		{:else}
			<div class="flex items-center gap-1 px-2 py-1 bg-amber-500/10 rounded text-xs text-amber-500">
				⚠ Setup Required
			</div>
		{/if}
		<button
			onclick={onConfigure}
			class="px-3 py-1 text-sm border border-border rounded hover:bg-muted transition-colors"
		>
			Configure
		</button>
	</div>
</div>
