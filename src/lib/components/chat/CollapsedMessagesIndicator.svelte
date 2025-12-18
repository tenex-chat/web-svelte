<script lang="ts">
	import type { Message, GroupedItem } from '$lib/utils/messageUtils';
	import { ChevronDown, ChevronRight, Settings } from 'lucide-svelte';
	import { slide } from 'svelte/transition';
	import MessageComponent from './Message.svelte';
	import ToolGroupDisplay from './ToolGroupDisplay.svelte';

	interface Props {
		count: number;
		items: GroupedItem[];
		onReply?: (message: Message) => void;
		onQuote?: (message: Message) => void;
		onTimeClick?: (event: import('@nostr-dev-kit/ndk').NDKEvent) => void;
	}

	let { count, items, onReply, onQuote, onTimeClick }: Props = $props();

	let isExpanded = $state(false);

	// Check if all items are tool groups
	const areAllToolGroups = $derived(
		items.length > 0 && items.every((item) => item.type === 'tool_group')
	);

	// Count total tools if all are tool groups
	const totalToolCount = $derived.by(() => {
		if (!areAllToolGroups) return 0;
		return items.reduce((sum, item) => {
			if (item.type === 'tool_group') {
				return sum + item.tools.length;
			}
			return sum;
		}, 0);
	});

	function toggleExpanded() {
		isExpanded = !isExpanded;
	}
</script>

<div class="px-4 py-1">
	<div class="flex gap-3">
		<!-- Avatar column spacer with continuous border line -->
		<div class="w-9 flex-shrink-0 relative">
			<!-- Border line continues through the collapsed indicator -->
			<div class="absolute left-1/2 -translate-x-1/2 inset-y-0 border-l border-border/60"></div>
		</div>

		<!-- Collapsed indicator -->
		<div class="flex-1 min-w-0">
			<button
				type="button"
				onclick={toggleExpanded}
				class="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors text-xs text-muted-foreground hover:text-foreground w-full text-left group"
			>
				{#if isExpanded}
					<ChevronDown class="w-3 h-3 flex-shrink-0" />
				{:else}
					<ChevronRight class="w-3 h-3 flex-shrink-0" />
				{/if}
				{#if areAllToolGroups}
					<Settings class="w-3 h-3 flex-shrink-0" />
					<span class="font-medium">
						Used {totalToolCount} {totalToolCount === 1 ? 'tool' : 'tools'}
					</span>
				{:else}
					<span class="font-medium">
						{count} {count === 1 ? 'message' : 'messages'}
					</span>
				{/if}
				<span class="text-muted-foreground/70 group-hover:text-muted-foreground/90">
					{isExpanded ? 'Click to collapse' : 'Click to expand'}
				</span>
			</button>

			<!-- Expanded items -->
			{#if isExpanded}
				<div transition:slide={{ duration: 200 }}>
					{#each items as item, index}
						{#if item.type === 'message'}
							<MessageComponent
								message={item.message}
								isLastMessage={false}
								isConsecutive={true}
								hasNextConsecutive={index < items.length - 1}
								{onReply}
								{onQuote}
								{onTimeClick}
							/>
						{:else if item.type === 'tool_group'}
							<ToolGroupDisplay
								tools={item.tools}
								thinking={item.thinking}
								isActive={false}
								isConsecutive={true}
								hasNextConsecutive={index < items.length - 1}
							/>
						{/if}
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
