<script lang="ts">
	import { metadataFeedStore, type MetadataFeedItem } from '$lib/stores/metadataFeed.svelte';
	import { metadataColumnStore } from '$lib/stores/metadataColumn.svelte';
	import { windowManager } from '$lib/stores/windowManager.svelte';
	import { cn } from '$lib/utils/cn';
	import { Activity, X } from 'lucide-svelte';
	import MetadataThreadList from './metadata/MetadataThreadList.svelte';

	interface Props {
		class?: string;
	}

	let { class: className }: Props = $props();

	// Initialize the feed store
	metadataFeedStore.init();

	// Get count
	const itemCount = $derived(metadataFeedStore.items.length);

	// Metadata accent color (emerald/green theme)
	const metadataColor = 'hsl(152, 68%, 40%)';

	// Handle item selection - open the chat
	async function handleItemSelect(item: MetadataFeedItem) {
		// Use the latest event to open the conversation
		if (item.latestEvent) {
			await windowManager.openChatFromEvent(item.latestEvent);
		}
	}
</script>

<div class={cn('w-96 flex-shrink-0 flex flex-col bg-card border-r border-border relative', className)}>
	<!-- Glow effect at top -->
	<div
		class="absolute top-0 left-0 right-0 h-96 pointer-events-none z-0"
		style="background: linear-gradient(to bottom, hsla(152, 68%, 50%, 0.25), hsla(152, 68%, 45%, 0.05) 70%, transparent)"
	></div>

	<!-- Column Header -->
	<div class="border-b border-border relative z-10">
		<div class="px-3 py-2">
			<div class="flex items-center gap-2">
				<!-- Status Icon -->
				<div
					class="w-6 h-6 rounded flex items-center justify-center text-white"
					style="background: {metadataColor}"
				>
					<Activity class="w-4 h-4" />
				</div>

				<!-- Title -->
				<h3 class="font-medium text-sm truncate flex-1 text-foreground">Status</h3>

				<!-- Close Button -->
				<button
					onclick={() => metadataColumnStore.close()}
					class="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground rounded hover:bg-muted transition-colors"
					title="Close status column"
					aria-label="Close status column"
				>
					<X class="h-3.5 w-3.5" />
				</button>
			</div>
		</div>

		<!-- Subtitle showing event count -->
		<div class="px-3 pb-2 text-xs text-muted-foreground">
			{itemCount} {itemCount === 1 ? 'conversation' : 'conversations'}
		</div>
	</div>

	<!-- Content -->
	<div class="flex-1 overflow-hidden relative">
		<MetadataThreadList
			onItemSelect={handleItemSelect}
		/>
	</div>
</div>
