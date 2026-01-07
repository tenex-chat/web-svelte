<script lang="ts">
	import { X, ZoomIn, ZoomOut, ExternalLink } from 'lucide-svelte';

	interface ImageAttachment {
		url: string;
		file?: File;
		isUploading?: boolean;
		progress?: number;
	}

	interface Props {
		attachments: ImageAttachment[];
		onRemove?: (index: number) => void;
	}

	let { attachments, onRemove }: Props = $props();

	let lightboxOpen = $state(false);
	let lightboxIndex = $state(0);
	let zoom = $state(1);

	function openLightbox(index: number) {
		lightboxIndex = index;
		lightboxOpen = true;
		zoom = 1;
	}

	function closeLightbox() {
		lightboxOpen = false;
		zoom = 1;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!lightboxOpen) return;
		if (e.key === 'Escape') {
			closeLightbox();
		} else if (e.key === 'ArrowLeft') {
			lightboxIndex = Math.max(0, lightboxIndex - 1);
		} else if (e.key === 'ArrowRight') {
			lightboxIndex = Math.min(attachments.length - 1, lightboxIndex + 1);
		}
	}

	function zoomIn() {
		zoom = Math.min(zoom + 0.5, 4);
	}

	function zoomOut() {
		zoom = Math.max(zoom - 0.5, 0.5);
	}

	function openInNewTab(url: string) {
		window.open(url, '_blank');
	}

	$effect(() => {
		if (lightboxOpen && lightboxIndex >= attachments.length) {
			lightboxIndex = Math.max(0, attachments.length - 1);
		}
		if (lightboxOpen && attachments.length === 0) {
			closeLightbox();
		}
	});
</script>

<svelte:window onkeydown={handleKeydown} />

{#if attachments.length > 0}
	<div class="flex flex-wrap gap-2 pb-2">
		{#each attachments as attachment, index}
			<div class="relative group">
				<!-- Thumbnail -->
				<button
					type="button"
					class="relative w-20 h-20 rounded-lg overflow-hidden border border-border bg-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
					onclick={() => openLightbox(index)}
					title="Click to preview"
				>
					{#if attachment.isUploading}
						<div class="absolute inset-0 flex flex-col items-center justify-center bg-muted">
							<div class="w-12 h-12 relative">
								<svg class="w-full h-full -rotate-90" viewBox="0 0 36 36">
									<circle
										cx="18"
										cy="18"
										r="15"
										fill="none"
										stroke="currentColor"
										stroke-width="3"
										class="text-muted-foreground/20"
									/>
									<circle
										cx="18"
										cy="18"
										r="15"
										fill="none"
										stroke="currentColor"
										stroke-width="3"
										class="text-primary"
										stroke-dasharray="94.25"
										stroke-dashoffset={94.25 * (1 - (attachment.progress ?? 0) / 100)}
										stroke-linecap="round"
									/>
								</svg>
								<span class="absolute inset-0 flex items-center justify-center text-xs font-medium">
									{attachment.progress ?? 0}%
								</span>
							</div>
						</div>
					{:else}
						<img
							src={attachment.url}
							alt="Attachment"
							class="w-full h-full object-cover"
						/>
					{/if}
				</button>

				<!-- Remove button -->
				{#if onRemove && !attachment.isUploading}
					<button
						type="button"
						class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
						onclick={() => onRemove(index)}
						title="Remove attachment"
					>
						<X class="w-3 h-3" />
					</button>
				{/if}
			</div>
		{/each}
	</div>
{/if}

<!-- Lightbox overlay -->
{#if lightboxOpen && attachments[lightboxIndex]}
	<div
		class="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
		onclick={closeLightbox}
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
				onclick={() => openInNewTab(attachments[lightboxIndex].url)}
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

		<!-- Image counter -->
		{#if attachments.length > 1}
			<div class="absolute top-4 left-4 text-white text-sm bg-black/50 px-3 py-1 rounded-lg">
				{lightboxIndex + 1} / {attachments.length}
			</div>
		{/if}

		<!-- Navigation arrows -->
		{#if attachments.length > 1}
			{#if lightboxIndex > 0}
				<button
					type="button"
					class="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
					onclick={(e) => { e.stopPropagation(); lightboxIndex--; }}
					title="Previous image"
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
					</svg>
				</button>
			{/if}
			{#if lightboxIndex < attachments.length - 1}
				<button
					type="button"
					class="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
					onclick={(e) => { e.stopPropagation(); lightboxIndex++; }}
					title="Next image"
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
					</svg>
				</button>
			{/if}
		{/if}

		<!-- Image container -->
		<div
			class="max-w-[90vw] max-h-[90vh] overflow-auto"
			onclick={(e) => e.stopPropagation()}
		>
			<img
				src={attachments[lightboxIndex].url}
				alt="Preview"
				class="transition-transform duration-200 ease-out"
				style="transform: scale({zoom}); transform-origin: center center;"
			/>
		</div>
	</div>
{/if}
