<script lang="ts">
	import { NDKEvent } from '@nostr-dev-kit/ndk';
	import { ndk } from '$lib/ndk.svelte';
	import type { NDKProject } from '$lib/events/NDKProject';
	import { ChevronDown, ChevronRight } from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';
	import { User } from '$lib/ndk/ui/user';
	import Message from './Message.svelte';
	import ThreadedMessage from './ThreadedMessage.svelte';
	import { ConversationState } from '$lib/stores/conversation-state.svelte';
	import {
		type Message as MessageType,
		calculateMessageProperties,
		getUniquePubkeys
	} from '$lib/utils/messageUtils';
	import EventCardInline from '$lib/ndk/components/event-card-inline/event-card-inline.svelte';

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
		isConsecutive = false,
		hasNextConsecutive = false,
		isLastReasoningMessage = false
	}: Props = $props();

	// Determine which event we're working with
	// At depth 0 with eventId, we're rendering the root
	// Otherwise we have a message to render
	const currentEvent = $derived(eventId && depth === 0 ? rootEvent : message?.event);

	// Create a Message object for the current event if we don't have one
	const currentMessage = $derived<MessageType>(
		message || (currentEvent ? { id: currentEvent.id, event: currentEvent } : { id: '', event: rootEvent })
	);

	// Track the actual currentEvent ID to avoid unnecessary recreations
	let currentEventId = $state<string | null>(null);
	let repliesState = $state<ConversationState | null>(null);

	// Create ConversationState only once when currentEvent is available
	$effect(() => {
		const newEventId = currentEvent?.id || null;

		// Only recreate if the event ID has actually changed
		if (newEventId !== currentEventId) {
			// Destroy old state if it exists
			if (repliesState) {
				repliesState.destroy();
				repliesState = null;
			}

			// Create new state with current event
			if (currentEvent) {
				repliesState = new ConversationState(ndk, currentEvent, {
					viewMode: 'threaded',
					isBrainstorm: false,
					currentUserPubkey: ndk.$currentUser?.pubkey,
					directRepliesOnly: true, // Only fetch direct replies to this event
					debug: false // Disable debug logging
				});

				repliesState.start();
			}

			// Update the tracked ID
			currentEventId = newEventId;
		}
	});

	// Cleanup on unmount only - no dependencies
	$effect(() => {
		return () => {
			if (repliesState) {
				repliesState.destroy();
			}
		};
	});

	// Get replies from conversation state
	const replies = $derived(repliesState?.displayMessages || []);

	// Calculate properties for replies
	const replyProperties = $derived(calculateMessageProperties(replies));

	// Get unique author pubkeys for collapse button avatars
	const uniquePubkeys = $derived(getUniquePubkeys(replies));

	// Get the most recent reply event
	const mostRecentReply = $derived(replies.length > 0 ? replies[replies.length - 1].event : null);

	// LOCAL COMPONENT STATE - each ThreadedMessage manages its own expansion
	let isExpanded = $state(false);

	function handleToggle() {
		isExpanded = !isExpanded;
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
			<div class={cn('ml-12 mt-1.5 relative flex flex-row')}>
				<button
					type="button"
					onclick={handleToggle}
					class="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium hover:bg-muted px-2 py-1 rounded"
				>
					<!-- Avatar stack showing unique authors -->
					<div class="flex -space-x-1.5">
						{#each uniquePubkeys.slice(0, 20) as pubkey, idx (pubkey)}
							<User.Root {ndk} {pubkey}>
								<div style="z-index: {20 - idx};">
									<User.Avatar class="w-5 h-5 ring-2 ring-white dark:ring-zinc-900 rounded-full" />
								</div>
							</User.Root>
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

				<!-- Show most recent reply when collapsed -->
				{#if !isExpanded && mostRecentReply}
					<div class="ml-2 inline-block">
						<EventCardInline {ndk} event={mostRecentReply} />
					</div>
				{/if}
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
