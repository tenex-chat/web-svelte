<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { NDKKind, type NDKEvent } from '@nostr-dev-kit/ndk';
	import type { NDKProject } from '$lib/events/NDKProject';
	import { formatRelativeTime } from '$lib/utils/time';
	import { MessageSquare, Users } from 'lucide-svelte';

	interface Props {
		project: NDKProject;
		selectedThread?: NDKEvent;
		onThreadSelect?: (thread: NDKEvent) => void;
		timeFilter?: string | null;
	}

	let { project, selectedThread, onThreadSelect, timeFilter = null }: Props = $props();

	// Get current user from NDK sessions
	const currentUser = $derived(ndk.$sessions?.[0]);

	// Subscribe to all threads (kind:11) for this project
	const threadsSubscription = ndk.$subscribe(() => ({
		filters: [
			{
				kinds: [NDKKind.Thread],
				'#a': [project.tagId()],
				limit: 50
			}
		],
		closeOnEose: false
	}));

	const threads = $derived(threadsSubscription.events);

	// Subscribe to all replies (kind:1111) for this project
	const repliesSubscription = ndk.$subscribe(() => ({
		filters: [
			{
				kinds: [NDKKind.GenericReply],
				'#a': [project.tagId()],
				limit: 500
			}
		],
		closeOnEose: false
	}));

	const replies = $derived(repliesSubscription.events);

	// Build thread metadata (reply count, participants, latest reply)
	const threadMetadata = $derived.by(() => {
		const metadata = new Map<
			string,
			{ replyCount: number; participants: Set<string>; latestReply: NDKEvent | null }
		>();

		// Initialize metadata for each thread
		for (const thread of threads) {
			metadata.set(thread.id, {
				replyCount: 0,
				participants: new Set([thread.pubkey]),
				latestReply: null
			});
		}

		// Process replies
		for (const reply of replies) {
			// Find which thread this reply belongs to
			const eTags = reply.tags.filter((tag) => tag[0] === 'E');
			for (const eTag of eTags) {
				const threadId = eTag[1];
				const meta = metadata.get(threadId);
				if (meta) {
					meta.replyCount++;
					meta.participants.add(reply.pubkey);
					// Update latest reply if this is newer
					if (
						!meta.latestReply ||
						(reply.created_at || 0) > (meta.latestReply.created_at || 0)
					) {
						meta.latestReply = reply;
					}
				}
			}
		}

		return metadata;
	});

	// Sort and filter threads based on timeFilter
	const sortedThreads = $derived.by(() => {
		if (threads.length === 0) return [];

		let filteredThreads = [...threads].filter((thread) => thread.created_at !== undefined);

		// Apply time filter if set
		if (timeFilter && replies) {
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
					// Track the last response from others and the user per thread
					const threadLastOtherReplyMap = new Map<string, number>();
					const threadLastUserReplyMap = new Map<string, number>();

					// Group replies by thread and categorize by author
					replies.forEach((reply) => {
						const threadIdTag = reply.tags?.find((tag) => tag[0] === 'E');
						if (threadIdTag && threadIdTag[1] && reply.created_at) {
							if (reply.pubkey === currentUser.pubkey) {
								// Track user's own replies
								const currentLast = threadLastUserReplyMap.get(threadIdTag[1]) || 0;
								if (reply.created_at > currentLast) {
									threadLastUserReplyMap.set(threadIdTag[1], reply.created_at);
								}
							} else {
								// Track replies from others
								const currentLast = threadLastOtherReplyMap.get(threadIdTag[1]) || 0;
								if (reply.created_at > currentLast) {
									threadLastOtherReplyMap.set(threadIdTag[1], reply.created_at);
								}
							}
						}
					});

					// Filter threads that need a response from the current user
					filteredThreads = filteredThreads.filter((thread) => {
						const lastOtherReplyTime = threadLastOtherReplyMap.get(thread.id);
						const lastUserReplyTime = threadLastUserReplyMap.get(thread.id);

						// If someone else has replied
						if (lastOtherReplyTime) {
							// Check if user has already responded after this reply
							if (lastUserReplyTime && lastUserReplyTime > lastOtherReplyTime) {
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
					// Track the last response time per thread (from anyone)
					const threadLastReplyMap = new Map<string, number>();

					// Group all replies by thread
					replies.forEach((reply) => {
						const threadIdTag = reply.tags?.find((tag) => tag[0] === 'E');
						if (threadIdTag && threadIdTag[1] && reply.created_at) {
							const currentLast = threadLastReplyMap.get(threadIdTag[1]) || 0;
							if (reply.created_at > currentLast) {
								threadLastReplyMap.set(threadIdTag[1], reply.created_at);
							}
						}
					});

					// Filter threads based on last activity time
					filteredThreads = filteredThreads.filter((thread) => {
						const lastReplyTime = threadLastReplyMap.get(thread.id);

						// If thread has any replies
						if (lastReplyTime) {
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
		return filteredThreads.sort((a, b) => {
			const aMeta = threadMetadata.get(a.id);
			const bMeta = threadMetadata.get(b.id);
			const aTime = aMeta?.latestReply?.created_at || a.created_at || 0;
			const bTime = bMeta?.latestReply?.created_at || b.created_at || 0;
			return bTime - aTime;
		});
	});

	function handleNewConversation() {
		if (onThreadSelect) {
			onThreadSelect(null as any); // Signal new conversation
		}
	}
</script>

<div class="flex flex-col h-full">
	<!-- Thread List -->
	<div class="flex-1 overflow-y-auto">
		{#if sortedThreads.length === 0}
			<div class="flex flex-col items-center justify-center h-32 text-center px-4">
				<MessageSquare class="w-12 h-12 text-gray-400 dark:text-gray-500 mb-2" />
				<p class="text-sm text-gray-600 dark:text-gray-300">
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
				<p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
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
			{#each sortedThreads as thread (thread.id)}
				{@const isSelected = selectedThread?.id === thread.id}
				{@const title = thread.tagValue('title') || thread.content?.slice(0, 50) || 'Untitled'}
				{@const meta = threadMetadata.get(thread.id)}
				{@const latestReply = meta?.latestReply}
				{@const replyCount = meta?.replyCount || 0}
				{@const participantCount = meta?.participants.size || 0}
				{@const displayTime = latestReply?.created_at || thread.created_at || 0}

				<button
					onclick={() => onThreadSelect?.(thread)}
					class="w-full text-left px-3 py-3 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors border-b border-gray-200 dark:border-zinc-700 {isSelected
						? 'bg-blue-50 dark:bg-blue-900/20'
						: ''}"
				>
					<div class="font-medium text-sm text-gray-900 dark:text-gray-100 truncate mb-1">
						{title}
					</div>
					{#if latestReply}
						<div class="text-xs text-gray-600 dark:text-gray-300 truncate mb-2">
							{latestReply.content.slice(0, 80)}{latestReply.content.length > 80 ? '...' : ''}
						</div>
					{/if}
					<div class="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-300">
						<div class="flex items-center gap-1">
							<MessageSquare class="w-3 h-3" />
							<span>{replyCount}</span>
						</div>
						<div class="flex items-center gap-1">
							<Users class="w-3 h-3" />
							<span>{participantCount}</span>
						</div>
						<span class="ml-auto">{formatRelativeTime(displayTime)}</span>
					</div>
				</button>
			{/each}
		{/if}
	</div>
</div>
