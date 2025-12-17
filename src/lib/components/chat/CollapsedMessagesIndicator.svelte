<script lang="ts">
	import type { Message } from '$lib/utils/messageUtils';
	import { ChevronDown, ChevronRight } from 'lucide-svelte';
	import { slide } from 'svelte/transition';
	import MessageComponent from './Message.svelte';

	interface Props {
		count: number;
		messages: Message[];
		onReply?: (message: Message) => void;
		onQuote?: (message: Message) => void;
		onTimeClick?: (event: import('@nostr-dev-kit/ndk').NDKEvent) => void;
	}

	let { count, messages, onReply, onQuote, onTimeClick }: Props = $props();

	let isExpanded = $state(false);

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

		<!-- Collapsed messages indicator -->
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
				<span class="font-medium">
					{count} {count === 1 ? 'message' : 'messages'}
				</span>
				<span class="text-muted-foreground/70 group-hover:text-muted-foreground/90">
					{isExpanded ? 'Click to collapse' : 'Click to expand'}
				</span>
			</button>

			<!-- Expanded messages -->
			{#if isExpanded}
				<div transition:slide={{ duration: 200 }}>
					{#each messages as message, index (message.id)}
						<MessageComponent
							{message}
							isLastMessage={false}
							isConsecutive={true}
							hasNextConsecutive={index < messages.length - 1}
							{onReply}
							{onQuote}
							{onTimeClick}
						/>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
