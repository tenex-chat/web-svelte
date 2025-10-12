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
	}

	let { project, selectedThread, onThreadSelect }: Props = $props();

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
			const eTags = reply.tags.filter((tag) => tag[0] === 'e');
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

	// Sort by most recent activity (either thread creation or latest reply)
	const sortedThreads = $derived.by(() => {
		return [...threads].sort((a, b) => {
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
	<!-- Header with New button -->
	<div class="p-2 border-b border-gray-200 flex items-center justify-between">
		<span class="text-xs font-medium text-gray-500">{threads.length} conversations</span>
		<button
			onclick={handleNewConversation}
			class="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
		>
			New
		</button>
	</div>

	<!-- Thread List -->
	<div class="flex-1 overflow-y-auto">
		{#if sortedThreads.length === 0}
			<div class="flex flex-col items-center justify-center h-32 text-center px-4">
				<span class="text-3xl mb-2">💬</span>
				<p class="text-sm text-gray-500">No conversations yet</p>
				<p class="text-xs text-gray-400 mt-1">Click "New" to start</p>
			</div>
		{:else}
			{#each sortedThreads as thread (thread.id)}
				{@const isSelected = selectedThread?.id === thread.id}
				{@const title = thread.tagValue('title') || thread.content?.slice(0, 50) || 'Untitled'}
				{@const timestamp = thread.created_at
					? new Date(thread.created_at * 1000).toLocaleString('en-US', {
							month: 'short',
							day: 'numeric',
							hour: 'numeric',
							minute: '2-digit'
						})
					: ''}

				<button
					onclick={() => onThreadSelect?.(thread)}
					class="w-full text-left px-3 py-2 hover:bg-gray-100 transition-colors border-l-2 {isSelected
						? 'border-blue-600 bg-blue-50'
						: 'border-transparent'}"
				>
					<div class="font-medium text-sm text-gray-900 truncate mb-1">{title}</div>
					<div class="text-xs text-gray-500">{timestamp}</div>
				</button>
			{/each}
		{/if}
	</div>
</div>
