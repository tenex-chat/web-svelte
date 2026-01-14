<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import type { NDKProject } from '$lib/events/NDKProject';
	import { MessageSquare } from 'lucide-svelte';
	import VirtualList from '@humanspeak/svelte-virtual-list';
	import { conversationMetadataStore } from '$lib/stores/conversationMetadata.svelte';
	import { storage } from '$lib/utils/storage.svelte';
	import { threadStore } from '$lib/stores/threadStore.svelte';
	import { globalFilterStore } from '$lib/stores/globalFilter.svelte';
	import ThreadListItem from './ThreadListItem.svelte';

	interface Props {
		project: NDKProject;
		selectedThread?: NDKEvent;
		onThreadSelect?: (thread: NDKEvent) => void;
		onThreadLongPress?: (thread: NDKEvent, position: { x: number; y: number }) => void;
	}

	let { project, selectedThread, onThreadSelect, onThreadLongPress }: Props = $props();

	// Get hierarchical threads for this specific project
	const hierarchicalThreads = $derived(threadStore.getHierarchicalThreads(project.tagId()));

	// Get the time filter label for empty state message
	const timeFilterLabel = $derived(() => {
		const timeFilter = globalFilterStore.value;
		if (!timeFilter) return null;
		const labels: Record<string, string> = {
			'1h': 'hour',
			'4h': '4 hours',
			'1d': '24 hours',
			'3d': '3 days',
			'7d': '7 days'
		};
		return labels[timeFilter] || timeFilter;
	});
</script>

<div class="flex flex-col h-full">
	<!-- Thread List -->
	<div class="flex-1 overflow-y-auto">
		{#if hierarchicalThreads.length === 0}
			<div class="flex flex-col items-center justify-center h-32 text-center px-4">
				<MessageSquare class="w-12 h-12 text-muted-foreground mb-2" />
				<p class="text-sm text-foreground">
					{#if globalFilterStore.value}
						No active conversations
					{:else}
						No conversations yet
					{/if}
				</p>
				<p class="text-xs text-muted-foreground mt-1">
					{#if !globalFilterStore.value}
						Click "New" to start
					{:else}
						No conversations with activity in the last {timeFilterLabel()}
					{/if}
				</p>
			</div>
		{:else}
			<VirtualList items={hierarchicalThreads}>
				{#snippet renderItem(item, index)}
					<ThreadListItem
						thread={item.thread}
						depth={item.depth}
						isLastChild={item.isLastChild}
						hasChildren={item.hasChildren}
						childCount={item.childCount}
						isCollapsed={threadStore.collapsedIds.has(item.thread.id)}
						onToggleCollapse={() => threadStore.toggleCollapse(item.thread.id)}
						isSelected={selectedThread?.id === item.thread.id}
						{conversationMetadataStore}
						threadMetadata={threadStore.threadMetadata}
						onclick={() => onThreadSelect?.(item.thread)}
						onlongpress={(position) => onThreadLongPress?.(item.thread, position)}
						onarchive={() => storage.archiveConversation(item.thread.id)}
					/>
				{/snippet}
			</VirtualList>
		{/if}
	</div>
</div>
