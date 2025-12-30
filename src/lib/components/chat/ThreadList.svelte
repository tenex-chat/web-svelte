<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import type { NDKProject } from '$lib/events/NDKProject';
	import { MessageSquare } from 'lucide-svelte';
	import VirtualList from '@humanspeak/svelte-virtual-list';
	import { conversationMetadataStore } from '$lib/stores/conversationMetadata.svelte';
	import ThreadListItem from './ThreadListItem.svelte';

	interface Props {
		project: NDKProject;
		selectedThread?: NDKEvent;
		onThreadSelect?: (thread: NDKEvent) => void;
		timeFilter?: string | null;
	}

	let { project, selectedThread, onThreadSelect, timeFilter = null }: Props = $props();

	// Get current user from NDK sessions
	const currentUser = $derived(ndk.$sessions?.currentUser);

	// Subscribe to all kind:1 events for this project
	const allEventsSubscription = ndk.$subscribe(() => ({
		filters: [
			{
				kinds: [1],
				'#a': [project.tagId()],
				limit: 500
			}
		],
		closeOnEose: false
	}));

	// Threads are kind:1 with NO e-tags (root events)
	const threads = $derived(
		allEventsSubscription.events.filter(e => !e.tags.some(t => t[0] === 'e'))
	);

	// Replies are kind:1 WITH e-tags (reply events)
	const replies = $derived(
		allEventsSubscription.events.filter(e => e.tags.some(t => t[0] === 'e'))
	);

	// Build thread metadata (reply count, participants, latest reply, time tracking for filters)
	// Using regular Map instead of SvelteMap - we create a new map each time anyway,
	// and SvelteMap's reactivity tracking inside $derived causes massive overhead
	// Also includes lastUserReplyTime and lastOtherReplyTime to avoid duplicate iteration in sortedThreads
	const threadMetadata = $derived.by(() => {
		const start = performance.now();
		const currentUserPubkey = currentUser?.pubkey;
		const metadata = new Map<
			string,
			{
				replyCount: number;
				participants: Set<string>;
				latestReply: NDKEvent | null;
				lastUserReplyTime: number;
				lastOtherReplyTime: number;
			}
		>();

		// Initialize metadata for each thread
		for (const thread of threads) {
			metadata.set(thread.id, {
				replyCount: 0,
				participants: new Set([thread.pubkey]),
				latestReply: null,
				lastUserReplyTime: 0,
				lastOtherReplyTime: 0
			});
		}

		// Process replies - single pass for all metadata including time tracking
		for (const reply of replies) {
			// Find which thread this reply belongs to via e-tag
			const eTags = reply.tags.filter((tag) => tag[0] === 'e');
			for (const eTag of eTags) {
				const threadId = eTag[1];
				const meta = metadata.get(threadId);
				if (meta) {
					meta.replyCount++;
					meta.participants.add(reply.pubkey);
					const replyTime = reply.created_at || 0;

					// Update latest reply if this is newer
					if (!meta.latestReply || replyTime > (meta.latestReply.created_at || 0)) {
						meta.latestReply = reply;
					}

					// Track user vs other reply times for "needs response" filter
					if (currentUserPubkey && reply.pubkey === currentUserPubkey) {
						if (replyTime > meta.lastUserReplyTime) {
							meta.lastUserReplyTime = replyTime;
						}
					} else {
						if (replyTime > meta.lastOtherReplyTime) {
							meta.lastOtherReplyTime = replyTime;
						}
					}
				}
			}
		}

		console.log(`[threadMetadata] threads: ${threads.length}, replies: ${replies.length}, time: ${(performance.now() - start).toFixed(2)}ms`);
		return metadata;
	});

	// Sort and filter threads based on timeFilter
	// Uses pre-computed time data from threadMetadata to avoid duplicate reply iteration
	const sortedThreads = $derived.by(() => {
		const start = performance.now();
		if (threads.length === 0) return [];

		let filteredThreads = [...threads].filter((thread) => thread.created_at !== undefined);

		// Apply time filter if set - uses pre-computed data from threadMetadata
		if (timeFilter) {
			const now = Math.floor(Date.now() / 1000);

			// Check if this is a "needs response" filter
			const isNeedsResponseFilter = timeFilter.startsWith('needs-response-');

			if (isNeedsResponseFilter && currentUser) {
				// Handle "needs response" filters - shows threads where others have replied but user hasn't
				const filterTime = timeFilter.replace('needs-response-', '');
				const thresholds: Record<string, number> = {
					'1h': 60 * 60,
					'4h': 4 * 60 * 60,
					'1d': 24 * 60 * 60
				};
				const threshold = thresholds[filterTime];

				if (threshold) {
					// Filter threads using pre-computed time data from threadMetadata
					filteredThreads = filteredThreads.filter((thread) => {
						const meta = threadMetadata.get(thread.id);
						if (!meta) return false;

						const lastOtherReplyTime = meta.lastOtherReplyTime;
						const lastUserReplyTime = meta.lastUserReplyTime;

						// If someone else has replied
						if (lastOtherReplyTime > 0) {
							// Check if user has already responded after this reply
							if (lastUserReplyTime > 0 && lastUserReplyTime > lastOtherReplyTime) {
								// User has already responded, don't show
								return false;
							}

							// Check if the time since the other person's reply exceeds the threshold
							const timeSinceLastOtherReply = now - lastOtherReplyTime;
							if (timeSinceLastOtherReply < threshold) {
								// Reply is still within the threshold time, don't show yet
								return false;
							}

							// Someone replied more than threshold ago and user hasn't responded yet
							return true;
						}

						// Don't include threads without replies from others
						return false;
					});
				}
			} else {
				// Handle regular activity filters - shows threads with any activity within the time frame
				const thresholds: Record<string, number> = {
					'1h': 60 * 60,
					'4h': 4 * 60 * 60,
					'1d': 24 * 60 * 60
				};
				const threshold = thresholds[timeFilter];

				if (threshold) {
					// Filter threads using pre-computed time data from threadMetadata
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

</script>

<div class="flex flex-col h-full">
	<!-- Thread List -->
	<div class="flex-1 overflow-y-auto">
		{#if sortedThreads.length === 0}
			<div class="flex flex-col items-center justify-center h-32 text-center px-4">
				<MessageSquare class="w-12 h-12 text-muted-foreground mb-2" />
				<p class="text-sm text-foreground">
					{#if timeFilter}
						{#if timeFilter.startsWith('needs-response-')}
							No conversations need your response
						{:else}
							No active conversations
						{/if}
					{:else}
						No conversations yet
					{/if}
				</p>
				<p class="text-xs text-muted-foreground mt-1">
					{#if !timeFilter}
						Click "New" to start
					{:else if timeFilter.startsWith('needs-response-')}
						{@const time = timeFilter.replace('needs-response-', '')}
						All caught up! No threads waiting for your response longer than {time === '1h'
							? '1 hour'
							: time === '4h'
								? '4 hours'
								: '24 hours'}
					{:else}
						No conversations with activity in the last {timeFilter === '1h'
							? 'hour'
							: timeFilter === '4h'
								? '4 hours'
								: '24 hours'}
					{/if}
				</p>
			</div>
		{:else}
			<VirtualList items={sortedThreads}>
				{#snippet renderItem(thread, index)}
					<ThreadListItem
						{thread}
						isSelected={selectedThread?.id === thread.id}
						{conversationMetadataStore}
						{threadMetadata}
						onclick={() => onThreadSelect?.(thread)}
					/>
				{/snippet}
			</VirtualList>
		{/if}
	</div>
</div>
