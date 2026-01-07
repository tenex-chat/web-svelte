<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import { Inbox } from 'lucide-svelte';
	import VirtualList from '@humanspeak/svelte-virtual-list';
	import { inboxStore } from '$lib/stores/inbox.svelte';
	import InboxThreadListItem from './InboxThreadListItem.svelte';

	interface Props {
		selectedThread?: NDKEvent;
		onThreadSelect?: (thread: NDKEvent) => void;
		onThreadLongPress?: (thread: NDKEvent, position: { x: number; y: number }) => void;
	}

	let { selectedThread, onThreadSelect, onThreadLongPress }: Props = $props();

	// Get events from inbox store (already filtered to ask events)
	const threads = $derived(inboxStore.events);
</script>

<div class="flex flex-col h-full">
	<!-- Thread List -->
	<div class="flex-1 overflow-y-auto">
		{#if threads.length === 0}
			<div class="flex flex-col items-center justify-center h-32 text-center px-4">
				<Inbox class="w-12 h-12 text-muted-foreground mb-2" />
				<p class="text-sm text-foreground">
					No messages in inbox
				</p>
				<p class="text-xs text-muted-foreground mt-1">
					Ask events from agents will appear here
				</p>
			</div>
		{:else}
			<VirtualList items={threads}>
				{#snippet renderItem(thread, index)}
					<InboxThreadListItem
						{thread}
						isSelected={selectedThread?.id === thread.id}
						isUnread={inboxStore.isEventUnread(thread)}
						onclick={() => onThreadSelect?.(thread)}
						onlongpress={(position) => onThreadLongPress?.(thread, position)}
					/>
				{/snippet}
			</VirtualList>
		{/if}
	</div>
</div>
