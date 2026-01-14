<script lang="ts">
	import { Activity } from 'lucide-svelte';
	import VirtualList from '@humanspeak/svelte-virtual-list';
	import { metadataFeedStore, type MetadataFeedItem } from '$lib/stores/metadataFeed.svelte';
	import MetadataThreadListItem from './MetadataThreadListItem.svelte';

	interface Props {
		selectedConversationId?: string;
		onItemSelect?: (item: MetadataFeedItem) => void;
	}

	let { selectedConversationId, onItemSelect }: Props = $props();

	// Get items from feed store
	const items = $derived(metadataFeedStore.items);

	// Key for forcing re-render when data changes
	const listKey = $derived(`metadata-${items.length}-${items[0]?.latestTimestamp ?? 0}`);
</script>

<div class="flex flex-col h-full">
	<!-- Thread List -->
	<div class="flex-1 overflow-y-auto">
		{#if items.length === 0}
			<div class="flex flex-col items-center justify-center h-32 text-center px-4">
				<Activity class="w-12 h-12 text-muted-foreground mb-2" />
				<p class="text-sm text-foreground">
					No activity yet
				</p>
				<p class="text-xs text-muted-foreground mt-1">
					Conversation status updates will appear here
				</p>
			</div>
		{:else}
			{#key listKey}
				<VirtualList items={items}>
					{#snippet renderItem(item, index)}
						<MetadataThreadListItem
							{item}
							isSelected={selectedConversationId === item.conversationId}
							onclick={() => onItemSelect?.(item)}
						/>
					{/snippet}
				</VirtualList>
			{/key}
		{/if}
	</div>
</div>
