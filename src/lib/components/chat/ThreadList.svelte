<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import type { NDKProject } from '$lib/events/NDKProject';
	import { MessageSquare } from 'lucide-svelte';
	import VirtualList from '@humanspeak/svelte-virtual-list';
	import { conversationMetadataStore } from '$lib/stores/conversationMetadata.svelte';
	import { storage } from '$lib/utils/storage.svelte';
	import ThreadListItem from './ThreadListItem.svelte';

	interface Props {
		project: NDKProject;
		selectedThread?: NDKEvent;
		onThreadSelect?: (thread: NDKEvent) => void;
		onThreadLongPress?: (thread: NDKEvent, position: { x: number; y: number }) => void;
		timeFilter?: string | null;
		onlyByMe?: boolean;
		showArchived?: boolean;
	}

	// Hierarchical thread item with depth for nesting
	interface HierarchicalThread {
		thread: NDKEvent;
		depth: number;
		isLastChild: boolean;
		hasChildren: boolean;
		childCount: number;
	}

	let { project, selectedThread, onThreadSelect, onThreadLongPress, timeFilter = null, onlyByMe = true, showArchived = false }: Props = $props();

	// Track collapsed thread IDs (parent threads whose children are hidden)
	let collapsedIds = $state<Set<string>>(new Set());

	function toggleCollapse(threadId: string) {
		const newSet = new Set(collapsedIds);
		if (newSet.has(threadId)) {
			newSet.delete(threadId);
		} else {
			newSet.add(threadId);
		}
		collapsedIds = newSet;
	}

	// Get archived conversation IDs reactively
	const archivedIds = $derived(new Set(Object.keys(storage.getArchivedConversations())));

	// Subscribe to all kind:1 events for this project
	const allEventsSubscription = ndk.$subscribe(() => ({
		filters: [
			{
				kinds: [1],
				'#a': [project.tagId()],
				limit: 501
			}
		],
		cacheUnconstrainFilter: [],
		closeOnEose: false
	}));

	// Debounced events snapshot - batches rapid event updates into single recomputation
	// Without this, every single incoming event triggers full recomputation of threads/replies/metadata
	let debouncedEvents = $state<NDKEvent[]>([]);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		const events = allEventsSubscription.events;
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			debouncedEvents = events;
		}, 150);
	});

	// Threads are kind:1 with NO e-tags (root events)
	const threads = $derived(
		debouncedEvents.filter(e => !e.tags.some(t => t[0] === 'e'))
	);

	// Replies are kind:1 WITH e-tags (reply events)
	const replies = $derived(
		debouncedEvents.filter(e => e.tags.some(t => t[0] === 'e'))
	);

	// Build thread metadata (latest reply)
	// Using regular Map instead of SvelteMap - we create a new map each time anyway,
	// and SvelteMap's reactivity tracking inside $derived causes massive overhead
	const threadMetadata = $derived.by(() => {
		const start = performance.now();
		const metadata = new Map<
			string,
			{
				latestReply: NDKEvent | null;
				lastUserReplyTime: number | null;
				lastOtherReplyTime: number | null;
			}
		>();
	
		// Initialize metadata for each thread
		for (const thread of threads) {
			metadata.set(thread.id, {
				latestReply: null,
				lastUserReplyTime: null,
				lastOtherReplyTime: null
			});
		}
	
		// Process replies
		for (const reply of replies) {
			// Find which thread this reply belongs to via e-tag
			const eTags = reply.tags.filter((tag) => tag[0] === 'e');
			for (const eTag of eTags) {
				const threadId = eTag[1];
				const meta = metadata.get(threadId);
				if (meta) {
					const replyTime = reply.created_at || 0;
	
					// Update latest reply if this is newer
					if (!meta.latestReply || replyTime > (meta.latestReply.created_at || 0)) {
						meta.latestReply = reply;
					}
	
					// Track last reply times by current user vs others (based on ndk.$currentPubkey)
					if (ndk.$currentPubkey && reply.pubkey === ndk.$currentPubkey) {
						meta.lastUserReplyTime = Math.max(meta.lastUserReplyTime || 0, replyTime);
					} else {
						meta.lastOtherReplyTime = Math.max(meta.lastOtherReplyTime || 0, replyTime);
					}
				}
			}
		}
	
		console.log(`[threadMetadata] threads: ${threads.length}, replies: ${replies.length}, time: ${(performance.now() - start).toFixed(2)}ms`);
		return metadata;
	});

	// Sort and filter threads based on timeFilter and onlyByMe
	const sortedThreads = $derived.by(() => {
		const start = performance.now();
		if (threads.length === 0) return [];

		let filteredThreads = [...threads].filter((thread) => thread.created_at !== undefined);

		// Apply "only by me" filter - show only threads started by the current user
		if (onlyByMe && ndk.$currentPubkey) {
			filteredThreads = filteredThreads.filter((thread) => thread.pubkey === ndk.$currentPubkey);
		}

		// Filter out archived conversations (unless showArchived is true)
		if (!showArchived) {
			filteredThreads = filteredThreads.filter((thread) => !archivedIds.has(thread.id));
		}

		// Apply time filter if set
		if (timeFilter) {
			const now = Math.floor(Date.now() / 1000);
			const thresholds: Record<string, number> = {
				"1h": 60 * 60,
				"4h": 4 * 60 * 60,
				"1d": 24 * 60 * 60,
				"3d": 3 * 24 * 60 * 60,
				"7d": 7 * 24 * 60 * 60,
			};
			const threshold = thresholds[timeFilter];

			if (threshold) {
				filteredThreads = filteredThreads.filter((thread) => {
					const meta = threadMetadata.get(thread.id);
					const lastReplyTime = meta?.latestReply?.created_at || 0;

					// If thread has any replies
					if (lastReplyTime > 0) {
						const timeSinceLastReply = now - lastReplyTime;
						// Show threads that have had a reply within the selected timeframe
						return timeSinceLastReply <= threshold;
					}

					// Also include threads created within the timeframe (even if no replies yet)
					const timeSinceCreation = now - (thread.created_at || 0);
					return timeSinceCreation <= threshold;
				});
			}
		}

		// Sort by most recent activity (either thread creation or latest reply)
		const sorted = filteredThreads.sort((a, b) => {
			const aMeta = threadMetadata.get(a.id);
			const bMeta = threadMetadata.get(b.id);
			const aTime = aMeta?.latestReply?.created_at || a.created_at || 0;
			const bTime = bMeta?.latestReply?.created_at || b.created_at || 0;
			return bTime - aTime;
		});

		console.log(`[sortedThreads] filtered: ${filteredThreads.length}, time: ${(performance.now() - start).toFixed(2)}ms`);
		return sorted;
	});

	// Build parent-child relationships from delegation tags
	// delegation tag format: ["delegation", "<parent-conversation-id>"]
	const threadHierarchy = $derived.by(() => {
		const start = performance.now();

		// Map from child ID -> parent ID (based on delegation tag)
		const childToParent = new Map<string, string>();
		// Map from parent ID -> array of child threads
		const parentToChildren = new Map<string, NDKEvent[]>();
		// Set of threads that are children (have a parent)
		const childIds = new Set<string>();

		// Build the mappings
		for (const thread of sortedThreads) {
			const delegationTag = thread.tags.find(t => t[0] === 'delegation');
			if (delegationTag && delegationTag[1]) {
				const parentId = delegationTag[1];
				childToParent.set(thread.id, parentId);
				childIds.add(thread.id);

				if (!parentToChildren.has(parentId)) {
					parentToChildren.set(parentId, []);
				}
				parentToChildren.get(parentId)!.push(thread);
			}
		}

		// Sort children by most recent activity (same as parent sorting)
		for (const [parentId, children] of parentToChildren) {
			children.sort((a, b) => {
				const aMeta = threadMetadata.get(a.id);
				const bMeta = threadMetadata.get(b.id);
				const aTime = aMeta?.latestReply?.created_at || a.created_at || 0;
				const bTime = bMeta?.latestReply?.created_at || b.created_at || 0;
				return bTime - aTime;
			});
		}

		// Count all descendants (recursive) for a thread
		function countDescendants(threadId: string): number {
			const children = parentToChildren.get(threadId) || [];
			let count = children.length;
			for (const child of children) {
				count += countDescendants(child.id);
			}
			return count;
		}

		// Build flattened hierarchical list with depth information
		const result: HierarchicalThread[] = [];

		function addThreadWithChildren(thread: NDKEvent, depth: number, isLastChild: boolean) {
			const children = parentToChildren.get(thread.id) || [];
			const childCount = countDescendants(thread.id);
			result.push({
				thread,
				depth,
				isLastChild,
				hasChildren: children.length > 0,
				childCount
			});

			// Only add children if this thread is not collapsed
			if (!collapsedIds.has(thread.id)) {
				children.forEach((child, index) => {
					addThreadWithChildren(child, depth + 1, index === children.length - 1);
				});
			}
		}

		// Start with root threads (those that have no parent in our list)
		const rootThreads = sortedThreads.filter(t => !childIds.has(t.id));
		rootThreads.forEach((thread, index) => {
			addThreadWithChildren(thread, 0, index === rootThreads.length - 1);
		});

		console.log(`[threadHierarchy] roots: ${rootThreads.length}, children: ${childIds.size}, total: ${result.length}, collapsed: ${collapsedIds.size}, time: ${(performance.now() - start).toFixed(2)}ms`);
		return result;
	});

</script>

<div class="flex flex-col h-full">
	<!-- Thread List -->
	<div class="flex-1 overflow-y-auto">
		{#if sortedThreads.length === 0}
			<div class="flex flex-col items-center justify-center h-32 text-center px-4">
				<MessageSquare class="w-12 h-12 text-muted-foreground mb-2" />
				<p class="text-sm text-foreground">
					{#if timeFilter}
						No active conversations
					{:else}
						No conversations yet
					{/if}
				</p>
				<p class="text-xs text-muted-foreground mt-1">
					{#if !timeFilter}
						Click "New" to start
					{:else}
						{@const timeLabel = timeFilter === '1h' ? 'hour' : timeFilter === '4h' ? '4 hours' : timeFilter === '1d' ? '24 hours' : timeFilter === '3d' ? '3 days' : '7 days'}
						No conversations with activity in the last {timeLabel}
					{/if}
				</p>
			</div>
		{:else}
			<VirtualList items={threadHierarchy}>
				{#snippet renderItem(item, index)}
					<ThreadListItem
						thread={item.thread}
						depth={item.depth}
						isLastChild={item.isLastChild}
						hasChildren={item.hasChildren}
						childCount={item.childCount}
						isCollapsed={collapsedIds.has(item.thread.id)}
						onToggleCollapse={() => toggleCollapse(item.thread.id)}
						isSelected={selectedThread?.id === item.thread.id}
						{conversationMetadataStore}
						{threadMetadata}
						onclick={() => onThreadSelect?.(item.thread)}
						onlongpress={(position) => onThreadLongPress?.(item.thread, position)}
						onarchive={() => storage.archiveConversation(item.thread.id)}
					/>
				{/snippet}
			</VirtualList>
		{/if}
	</div>
</div>
