<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import { ndk } from '$lib/ndk.svelte';
	import { NDKKind } from '@nostr-dev-kit/ndk';
	import type { NDKProject } from '$lib/events/NDKProject';
	import { Avatar } from '@nostr-dev-kit/svelte';
	import { ChevronDown, ChevronRight } from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';
	import Message from './Message.svelte';
	import ThreadedMessage from './ThreadedMessage.svelte';
	import { expandedRepliesStore } from '$lib/stores/expandedReplies.svelte';
	import {
		type Message as MessageType,
		calculateMessageProperties,
		getUniquePubkeys
	} from '$lib/utils/messageUtils';

	interface Props {
		eventId?: string;
		message?: MessageType;
		rootEvent: NDKEvent;
		depth: number;
		project?: NDKProject | null;
		onTimeClick?: (event: NDKEvent) => void;
		onConversationNavigate?: (event: NDKEvent) => void;
		isConsecutive?: boolean;
		hasNextConsecutive?: boolean;
		isLastReasoningMessage?: boolean;
	}

	let {
		eventId,
		message,
		rootEvent,
		depth,
		project = null,
		onTimeClick,
		onConversationNavigate,
		isLastReasoningMessage = false
	}: Props = $props();

	// Determine which event we're working with
	// At depth 0 with eventId, we're rendering the root
	// Otherwise we have a message to render
	const currentEvent = $derived(eventId && depth === 0 ? rootEvent : message?.event);

	// Create a Message object for the current event if we don't have one
	const currentMessage = $derived<MessageType>(
		message || (currentEvent ? { id: currentEvent.id, event: currentEvent } : null)
	);

	// Subscribe to direct replies to this event
	// Uses NIP-22 threading: looks for events with 'e' tags matching this event's ID
	const repliesSubscription = $derived(
		currentEvent
			? ndk.$subscribe(() => ({
					filters: [
						{
							kinds: [1111 as NDKKind], // Generic Reply
							'#e': [currentEvent.id],
							limit: 100
						}
					],
					closeOnEose: false
				}))
			: null
	);

	const replies = $derived.by(() => {
		if (!repliesSubscription) return [];
		const events = repliesSubscription.events || [];
		// Convert to Message objects and sort by created_at
		return events
			.map((event) => ({ id: event.id, event }))
			.sort((a, b) => (a.event.created_at || 0) - (b.event.created_at || 0));
	});

	// Calculate properties for replies
	const replyProperties = $derived(calculateMessageProperties(replies));

	// Get unique author pubkeys for collapse button avatars
	const uniquePubkeys = $derived(getUniquePubkeys(replies));

	// Check if replies are expanded (only relevant for depth > 0)
	const isExpanded = $derived(
		currentEvent ? expandedRepliesStore.isExpanded(currentEvent.id) : false
	);

	function handleToggle() {
		if (currentEvent) {
			expandedRepliesStore.toggle(currentEvent.id);
		}
	}
</script>

{#if currentEvent && currentMessage}
	{#if depth === 0}
		<!-- ROOT LEVEL: Render root event and its direct replies (always expanded) -->

		<!-- Render the root event itself -->
		<Message
			message={currentMessage}
			isLastMessage={replies.length === 0 && !!currentEvent.tags?.some((t) => t[0] === 'reasoning')}
			isConsecutive={false}
			hasNextConsecutive={replies.length > 0 && replies[0].event.pubkey === currentEvent.pubkey}
			{onTimeClick}
		/>

		<!-- Render direct replies recursively -->
		{#each replyProperties as { message: replyMsg, isConsecutive: replyConsecutive, hasNextConsecutive: replyHasNext, isLastReasoningMessage: replyLastReasoning } (replyMsg.id)}
			<ThreadedMessage
				message={replyMsg}
				{rootEvent}
				depth={1}
				{project}
				{onTimeClick}
				{onConversationNavigate}
				isConsecutive={replyConsecutive}
				hasNextConsecutive={replyHasNext}
				isLastReasoningMessage={replyLastReasoning}
			/>
		{/each}
	{:else}
		<!-- NESTED LEVEL: Render message with collapsible replies -->

		<!-- Render the current event -->
		<Message
			message={currentMessage}
			isLastMessage={isLastReasoningMessage}
			{isConsecutive}
			{hasNextConsecutive}
			{onTimeClick}
		/>

		<!-- Render replies if any exist -->
		{#if replies.length > 0}
			<!-- Toggle button for replies -->
			<div class={cn('ml-12 mt-1.5 relative')}>
				<button
					type="button"
					onclick={handleToggle}
					class="flex items-center gap-1.5 text-xs text-primary dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors font-medium hover:bg-blue-50 dark:hover:bg-blue-950/30 px-2 py-1 rounded"
				>
					<!-- Avatar stack showing unique authors -->
					<div class="flex -space-x-1.5">
						{#each uniquePubkeys.slice(0, 20) as pubkey, idx (pubkey)}
							<div style="z-index: {20 - idx};">
								<Avatar
									{ndk}
									{pubkey}
									size={20}
									class="ring-2 ring-white dark:ring-zinc-900 rounded-full"
								/>
							</div>
						{/each}
						{#if uniquePubkeys.length > 20}
							<span class="ml-1 text-[10px] text-muted-foreground">
								+{uniquePubkeys.length - 20}
							</span>
						{/if}
					</div>

					<!-- Reply count -->
					<span>{replies.length} {replies.length === 1 ? 'reply' : 'replies'}</span>

					<!-- Chevron -->
					{#if isExpanded}
						<ChevronDown class="w-3 h-3" />
					{:else}
						<ChevronRight class="w-3 h-3" />
					{/if}
				</button>
			</div>

			<!-- Render reply messages (when expanded) -->
			{#if isExpanded}
				<div class="ml-12 mt-2">
					{#each replyProperties as { message: replyMsg, isConsecutive: replyConsecutive, hasNextConsecutive: replyHasNext, isLastReasoningMessage: replyLastReasoning } (replyMsg.id)}
						<ThreadedMessage
							message={replyMsg}
							{rootEvent}
							depth={depth + 1}
							{project}
							{onTimeClick}
							{onConversationNavigate}
							isConsecutive={replyConsecutive}
							hasNextConsecutive={replyHasNext}
							isLastReasoningMessage={replyLastReasoning}
						/>
					{/each}
				</div>
			{/if}
		{/if}
	{/if}
{/if}
