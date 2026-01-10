<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { aiConfigStore } from '$lib/stores/aiConfig.svelte';
	import { aiService } from '$lib/services/ai-service';
	import NDKBlossom from '@nostr-dev-kit/blossom';
	import { cn } from '$lib/utils/cn';

	interface Props {
		/** Placeholder text for the prompt input */
		placeholder?: string;
		/** Called when an image is generated and uploaded to Blossom */
		onImageReady?: (url: string) => void;
		/** Called when user accepts the current image */
		onAccept?: (url: string) => void;
		/** Called when user rejects/clears the current image */
		onReject?: () => void;
		/** Initial prompt value */
		initialPrompt?: string;
		/** Show the accept/reject buttons */
		showAcceptReject?: boolean;
		/** Custom button label for accept */
		acceptLabel?: string;
		/** Custom button label for generate */
		generateLabel?: string;
		/** Compact mode - smaller UI */
		compact?: boolean;
	}

	let {
		placeholder = 'Describe the image you want to generate...',
		onImageReady,
		onAccept,
		onReject,
		initialPrompt = '',
		showAcceptReject = true,
		acceptLabel = 'Use this image',
		generateLabel = 'Generate',
		compact = false
	}: Props = $props();

	const config = $derived(aiConfigStore.config);
	const imageGenSettings = $derived(config.imageGenSettings);
	const isConfigured = $derived(imageGenSettings.enabled && !!imageGenSettings.model);

	let prompt = $state(initialPrompt);
	let isGenerating = $state(false);
	let isUploading = $state(false);
	let uploadProgress = $state(0);
	let generatedImageUrl = $state<string | null>(null);
	let tempImageData = $state<{ url?: string; base64?: string } | null>(null);
	let error = $state<string | null>(null);

	async function handleGenerate() {
		if (!prompt.trim() || !isConfigured) return;

		isGenerating = true;
		error = null;
		generatedImageUrl = null;
		tempImageData = null;

		try {
			const apiKey = imageGenSettings.apiKey || config.openAIApiKey;
			if (!apiKey) {
				error = 'No API key configured. Add one in AI Settings > Image Generation.';
				return;
			}

			const result = await aiService.generateImage(prompt, imageGenSettings, apiKey);

			if (result.error) {
				error = result.error;
				return;
			}

			tempImageData = result;

			// If we have base64 data, convert to blob and upload to Blossom
			if (result.base64) {
				await uploadBase64ToBlossom(result.base64);
			} else if (result.url) {
				// If we have a URL, we could either use it directly or download and re-upload
				// For now, let's download and upload to ensure it's on Blossom
				await uploadUrlToBlossom(result.url);
			}
		} catch (err) {
			console.error('Image generation failed:', err);
			error = err instanceof Error ? err.message : 'Image generation failed';
		} finally {
			isGenerating = false;
		}
	}

	async function uploadBase64ToBlossom(base64: string) {
		if (!ndk || !ndk.$currentUser) {
			error = 'Please sign in to upload images';
			return;
		}

		isUploading = true;
		uploadProgress = 0;

		try {
			// Convert base64 to blob
			const byteCharacters = atob(base64);
			const byteNumbers = new Array(byteCharacters.length);
			for (let i = 0; i < byteCharacters.length; i++) {
				byteNumbers[i] = byteCharacters.charCodeAt(i);
			}
			const byteArray = new Uint8Array(byteNumbers);
			const blob = new Blob([byteArray], { type: 'image/png' });
			const file = new File([blob], 'ai-generated.png', { type: 'image/png' });

			await uploadFileToBlossom(file);
		} catch (err) {
			console.error('Failed to upload base64 image:', err);
			error = err instanceof Error ? err.message : 'Failed to upload image';
		} finally {
			isUploading = false;
			uploadProgress = 0;
		}
	}

	async function uploadUrlToBlossom(imageUrl: string) {
		if (!ndk || !ndk.$currentUser) {
			error = 'Please sign in to upload images';
			return;
		}

		isUploading = true;
		uploadProgress = 0;

		try {
			// Fetch the image from the URL
			const response = await fetch(imageUrl);
			if (!response.ok) {
				throw new Error(`Failed to fetch image: ${response.statusText}`);
			}

			const blob = await response.blob();
			const file = new File([blob], 'ai-generated.png', { type: blob.type || 'image/png' });

			await uploadFileToBlossom(file);
		} catch (err) {
			console.error('Failed to upload URL image:', err);
			error = err instanceof Error ? err.message : 'Failed to upload image';
		} finally {
			isUploading = false;
			uploadProgress = 0;
		}
	}

	async function uploadFileToBlossom(file: File) {
		const blossom = new NDKBlossom(ndk);

		blossom.onUploadProgress = (progress) => {
			const progressPercent = Math.round((progress.loaded / progress.total) * 100);
			uploadProgress = progressPercent;
			return 'continue';
		};

		blossom.onUploadFailed = (err, serverUrl) => {
			console.error('Upload failed:', err, 'on server:', serverUrl);
		};

		const imeta = await blossom.upload(file, {
			server: 'https://blossom.primal.net'
		});

		if (imeta.url) {
			generatedImageUrl = imeta.url;
			onImageReady?.(imeta.url);
		} else {
			throw new Error('Upload completed but no URL returned');
		}
	}

	function handleAccept() {
		if (generatedImageUrl) {
			onAccept?.(generatedImageUrl);
		}
	}

	function handleReject() {
		generatedImageUrl = null;
		tempImageData = null;
		onReject?.();
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleGenerate();
		}
	}

	// Preview URL for display (either Blossom URL or temporary data)
	const previewUrl = $derived(
		generatedImageUrl ||
		(tempImageData?.url) ||
		(tempImageData?.base64 ? `data:image/png;base64,${tempImageData.base64}` : null)
	);

	const isLoading = $derived(isGenerating || isUploading);
</script>

<div class={cn('space-y-3', compact && 'space-y-2')}>
	{#if !isConfigured}
		<div class={cn(
			'p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-600 dark:text-amber-400',
			compact && 'p-2 text-xs'
		)}>
			<p class={cn('text-sm', compact && 'text-xs')}>
				Image generation is not configured. Enable it in <a href="/settings" class="underline hover:text-amber-500">AI Settings</a>.
			</p>
		</div>
	{:else}
		<!-- Prompt Input -->
		<div class="flex gap-2">
			<input
				type="text"
				bind:value={prompt}
				onkeydown={handleKeyDown}
				{placeholder}
				disabled={isLoading}
				class={cn(
					'flex-1 px-3 py-2 border border-border rounded-lg bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50',
					compact && 'text-sm py-1.5'
				)}
			/>
			<button
				onclick={handleGenerate}
				disabled={isLoading || !prompt.trim()}
				class={cn(
					'px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2',
					compact && 'px-3 py-1.5 text-sm'
				)}
			>
				{#if isGenerating}
					<div class={cn(
						'border-2 border-primary-foreground border-t-transparent rounded-full animate-spin',
						compact ? 'w-3 h-3' : 'w-4 h-4'
					)}></div>
					Generating...
				{:else if isUploading}
					<div class={cn(
						'border-2 border-primary-foreground border-t-transparent rounded-full animate-spin',
						compact ? 'w-3 h-3' : 'w-4 h-4'
					)}></div>
					Uploading {uploadProgress}%
				{:else}
					🎨 {generateLabel}
				{/if}
			</button>
		</div>

		<!-- Error Display -->
		{#if error}
			<div class={cn(
				'p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500',
				compact && 'p-2'
			)}>
				<p class={cn('text-sm', compact && 'text-xs')}>{error}</p>
			</div>
		{/if}

		<!-- Generated Image Preview -->
		{#if previewUrl}
			<div class="space-y-2">
				<div class={cn(
					'rounded-lg overflow-hidden border border-border bg-muted',
					compact ? 'max-h-48' : 'max-h-96'
				)}>
					<img
						src={previewUrl}
						alt="Generated image"
						class="w-full h-full object-contain"
					/>
				</div>

				{#if !generatedImageUrl && (isUploading || tempImageData)}
					<p class={cn('text-muted-foreground text-center', compact ? 'text-xs' : 'text-sm')}>
						{isUploading ? `Uploading to Blossom... ${uploadProgress}%` : 'Processing...'}
					</p>
				{:else if generatedImageUrl}
					<p class={cn('text-muted-foreground', compact ? 'text-xs' : 'text-xs')}>
						Generated with {imageGenSettings.model} at {imageGenSettings.size}
					</p>

					{#if showAcceptReject}
						<div class="flex gap-2">
							<button
								onclick={handleAccept}
								class={cn(
									'flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors',
									compact && 'px-3 py-1.5 text-sm'
								)}
							>
								✓ {acceptLabel}
							</button>
							<button
								onclick={handleReject}
								class={cn(
									'flex-1 px-4 py-2 border border-border text-foreground rounded-lg font-medium hover:bg-muted transition-colors',
									compact && 'px-3 py-1.5 text-sm'
								)}
							>
								✗ Try again
							</button>
						</div>
					{/if}
				{/if}
			</div>
		{/if}
	{/if}
</div>
