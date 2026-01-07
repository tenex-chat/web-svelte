<script lang="ts">
	import { X, ZoomIn, ZoomOut, Download, ExternalLink } from 'lucide-svelte';

	interface Props {
		src: string;
		alt?: string;
	}

	let { src, alt = '' }: Props = $props();

	let isLightboxOpen = $state(false);
	let zoom = $state(1);
	let isLoading = $state(true);
	let hasError = $state(false);

	function openLightbox() {
		isLightboxOpen = true;
		zoom = 1;
	}

	function closeLightbox() {
		isLightboxOpen = false;
		zoom = 1;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			closeLightbox();
		}
	}

	function zoomIn() {
		zoom = Math.min(zoom + 0.5, 4);
	}

	function zoomOut() {
		zoom = Math.max(zoom - 0.5, 0.5);
	}

	function handleImageLoad() {
		isLoading = false;
		hasError = false;
	}

	function handleImageError() {
		isLoading = false;
		hasError = true;
	}

	function handleDownload() {
		const link = document.createElement('a');
		link.href = src;
		link.download = src.split('/').pop() || 'image';
		link.target = '_blank';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

	function openInNewTab() {
		window.open(src, '_blank');
	}
</script>

<svelte:window onkeydown={isLightboxOpen ? handleKeydown : undefined} />

<!-- Inline thumbnail -->
<button
	type="button"
	class="inline-block cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-lg overflow-hidden"
	onclick={openLightbox}
	title={alt || 'Click to view full size'}
>
	{#if isLoading && !hasError}
		<div class="w-64 h-40 bg-muted animate-pulse rounded-lg flex items-center justify-center">
			<span class="text-xs text-muted-foreground">Loading...</span>
		</div>
	{/if}
	{#if hasError}
		<div class="w-64 h-40 bg-muted rounded-lg flex items-center justify-center border border-border">
			<span class="text-xs text-muted-foreground">Failed to load image</span>
		</div>
	{:else}
		<img
			{src}
			{alt}
			class="max-w-md max-h-80 rounded-lg object-contain hover:opacity-90 transition-opacity"
			class:hidden={isLoading}
			onload={handleImageLoad}
			onerror={handleImageError}
		/>
	{/if}
</button>

<!-- Lightbox overlay -->
{#if isLightboxOpen}
	<div
		class="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
		onclick={closeLightbox}
		onkeydown={handleKeydown}
		role="dialog"
		aria-modal="true"
		aria-label="Image preview"
		tabindex="-1"
	>
		<!-- Controls bar -->
		<div
			class="absolute top-4 right-4 flex items-center gap-2 z-10"
			onclick={(e) => e.stopPropagation()}
		>
			<button
				type="button"
				onclick={zoomOut}
				class="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
				title="Zoom out"
				disabled={zoom <= 0.5}
			>
				<ZoomOut class="w-5 h-5" />
			</button>
			<span class="text-white text-sm min-w-[3rem] text-center">{Math.round(zoom * 100)}%</span>
			<button
				type="button"
				onclick={zoomIn}
				class="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
				title="Zoom in"
				disabled={zoom >= 4}
			>
				<ZoomIn class="w-5 h-5" />
			</button>
			<div class="w-px h-6 bg-white/20 mx-1"></div>
			<button
				type="button"
				onclick={handleDownload}
				class="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
				title="Download"
			>
				<Download class="w-5 h-5" />
			</button>
			<button
				type="button"
				onclick={openInNewTab}
				class="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
				title="Open in new tab"
			>
				<ExternalLink class="w-5 h-5" />
			</button>
			<div class="w-px h-6 bg-white/20 mx-1"></div>
			<button
				type="button"
				onclick={closeLightbox}
				class="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
				title="Close (Esc)"
			>
				<X class="w-5 h-5" />
			</button>
		</div>

		<!-- Image container -->
		<div
			class="max-w-[90vw] max-h-[90vh] overflow-auto"
			onclick={(e) => e.stopPropagation()}
		>
			<img
				{src}
				{alt}
				class="transition-transform duration-200 ease-out"
				style="transform: scale({zoom}); transform-origin: center center;"
			/>
		</div>

		<!-- Alt text / caption -->
		{#if alt}
			<div class="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/50 rounded-lg text-white text-sm max-w-md text-center">
				{alt}
			</div>
		{/if}
	</div>
{/if}
