<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import { type ChatViewMode, type Message } from '$lib/utils/messageUtils';
	import ChatActionsMenu from './ChatActionsMenu.svelte';
	import CopyThreadMenu from './CopyThreadMenu.svelte';
	import { GitFork, MessageSquareText, List, AlignJustify } from 'lucide-svelte';

	interface Props {
		rootEvent?: NDKEvent | null;
		messages: Message[];
		viewMode?: ChatViewMode;
	}

	let { rootEvent, messages, viewMode = $bindable('threaded') }: Props = $props();

	function cycleViewMode() {
		if (viewMode === 'threaded') {
			viewMode = 'flattened';
		} else if (viewMode === 'flattened') {
			viewMode = 'delegation';
		} else {
			viewMode = 'threaded';
		}
	}

	function getViewModeTitle(): string {
		switch (viewMode) {
			case 'threaded':
				return 'Switch to flat view';
			case 'flattened':
				return 'Switch to tree view';
			case 'delegation':
				return 'Switch to threaded view';
			default:
				return 'Toggle view mode';
		}
	}
</script>

<!-- Chat Actions Menu (Summarize, etc.) -->
{#if messages.length > 0 && rootEvent}
	<ChatActionsMenu {rootEvent} {messages} />
{/if}

<!-- Copy Thread Menu -->
<CopyThreadMenu {messages} rootEvent={rootEvent ?? null} />

<!-- View Mode Toggle -->
<button
	onclick={cycleViewMode}
	class="p-2 hover:bg-secondary rounded transition-colors"
	title={getViewModeTitle()}
>
	{#if viewMode === 'threaded'}
		<List class="w-4 h-4 text-muted-foreground" />
	{:else if viewMode === 'flattened'}
		<AlignJustify class="w-4 h-4 text-muted-foreground" />
	{:else}
		<GitFork class="w-4 h-4 text-muted-foreground" />
	{/if}
</button>
