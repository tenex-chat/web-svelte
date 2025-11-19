<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import type { Message } from '$lib/utils/messageProcessor';
	import type { ThreadViewMode } from '$lib/utils/messageProcessor';
	import ChatActionsMenu from './ChatActionsMenu.svelte';
	import CopyThreadMenu from './CopyThreadMenu.svelte';

	interface Props {
		rootEvent?: NDKEvent | null;
		messages: Message[];
		viewMode?: ThreadViewMode;
	}

	let { rootEvent, messages, viewMode = $bindable('threaded') }: Props = $props();

	function toggleViewMode() {
		viewMode = viewMode === 'threaded' ? 'flattened' : 'threaded';
	}
</script>

<!-- Chat Actions Menu (Summarize, etc.) -->
{#if messages.length > 0 && rootEvent}
	<ChatActionsMenu {rootEvent} {messages} />
{/if}

<!-- Copy Thread Menu -->
<CopyThreadMenu {messages} {rootEvent} />

<!-- View Mode Toggle -->
<button
	onclick={toggleViewMode}
	class="p-2 hover:bg-secondary rounded transition-colors"
	title={viewMode === 'threaded' ? 'Switch to flat view' : 'Switch to threaded view'}
>
	{#if viewMode === 'threaded'}
		<svg class="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M4 6h16M4 12h16M4 18h16"
			/>
		</svg>
	{:else}
		<svg class="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M4 6h16M4 12h16M4 18h16"
			/>
		</svg>
	{/if}
</button>
