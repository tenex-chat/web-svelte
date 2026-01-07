<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import { type ChatViewMode, type Message } from '$lib/utils/messageUtils';
	import ChatActionsMenu from './ChatActionsMenu.svelte';
	import CopyThreadMenu from './CopyThreadMenu.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Rows3, List, AlignJustify, Check, LayoutList } from 'lucide-svelte';

	interface Props {
		rootEvent?: NDKEvent | null;
		messages: Message[];
		viewMode?: ChatViewMode;
	}

	let { rootEvent, messages, viewMode = $bindable('threaded') }: Props = $props();

	function setViewMode(mode: ChatViewMode) {
		viewMode = mode;
	}

	function getCurrentIcon() {
		switch (viewMode) {
			case 'threaded':
				return List;
			case 'flattened':
				return AlignJustify;
			case 'delegation':
				return Rows3;
			default:
				return List;
		}
	}

	const CurrentIcon = $derived(getCurrentIcon());
</script>

<!-- Chat Actions Menu (Summarize, etc.) -->
{#if messages.length > 0 && rootEvent}
	<ChatActionsMenu {rootEvent} {messages} />
{/if}

<!-- Copy Thread Menu -->
<CopyThreadMenu {messages} rootEvent={rootEvent ?? null} />

<!-- View Mode Dropdown -->
<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<button
				{...props}
				class="p-2 hover:bg-secondary rounded transition-colors"
				title="Change view mode"
			>
				<CurrentIcon class="w-4 h-4 text-muted-foreground" />
			</button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end" class="w-[180px]">
		<DropdownMenu.Item onclick={() => setViewMode('threaded')}>
			<div class="flex items-center justify-between w-full">
				<div class="flex items-center gap-2">
					<List class="w-4 h-4" />
					<span>Threaded</span>
				</div>
				{#if viewMode === 'threaded'}
					<Check class="w-4 h-4" />
				{/if}
			</div>
		</DropdownMenu.Item>
		<DropdownMenu.Item onclick={() => setViewMode('flattened')}>
			<div class="flex items-center justify-between w-full">
				<div class="flex items-center gap-2">
					<AlignJustify class="w-4 h-4" />
					<span>Flat</span>
				</div>
				{#if viewMode === 'flattened'}
					<Check class="w-4 h-4" />
				{/if}
			</div>
		</DropdownMenu.Item>
		<DropdownMenu.Item onclick={() => setViewMode('delegation')}>
			<div class="flex items-center justify-between w-full">
				<div class="flex items-center gap-2">
					<Rows3 class="w-4 h-4" />
					<span>Swimlane View</span>
				</div>
				{#if viewMode === 'delegation'}
					<Check class="w-4 h-4" />
				{/if}
			</div>
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>
