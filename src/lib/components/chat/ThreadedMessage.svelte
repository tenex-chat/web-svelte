<script lang="ts">
	import { NDKEvent } from '@nostr-dev-kit/ndk';
	import { ndk } from '$lib/ndk.svelte';
	import { NDKKind } from '$lib/kinds';
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
	import { processEventsToMessages } from '$lib/utils/messageProcessor';
	import { streamingMessageStore } from '$lib/utils/streamingMessageStore.svelte';

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
		message || (currentEvent ? { id: currentEvent.id, event: currentEvent } : null)
	);

	// Track processed streaming events for this component instance
	let processedStreamingEvents = new Set<string>();

	// Subscribe to direct replies to this event
	// Uses NIP-22 threading: looks for events with 'e' tags matching this event's ID
	// Now includes streaming kinds for proper support
	const repliesSubscription = $derived(
		currentEvent
			? ndk.$subscribe(() => ({
					filters: [
						{
							kinds: [1111 as NDKKind], // Generic Reply
							'#e': [currentEvent.id],
							limit: 100
						},
						{
							// Add streaming events with proper filtering
							kinds: [
								NDKKind.TenexStreamingResponse,
								NDKKind.TenexAgentTypingStart,
								NDKKind.TenexAgentTypingStop
							],
							'#e': [currentEvent.id], // Only streaming events for THIS message
							limit: 5
						}
					],
					closeOnEose: false
				}))
			: null
	);

	// Process streaming events into the global store
	$effect(() => {
		if (!repliesSubscription) return;

		const streamingEvents = repliesSubscription.events.filter(e =>
			e.kind === NDKKind.TenexStreamingResponse ||
			e.kind === NDKKind.TenexAgentTypingStart
		);

		for (const event of streamingEvents) {
			if (!processedStreamingEvents.has(event.id)) {
				streamingMessageStore.processStreamingEvent(event);
				processedStreamingEvents.add(event.id);
			}
		}

		// Handle typing stop events
		const typingStopEvents = repliesSubscription.events.filter(e =>
			e.kind === NDKKind.TenexAgentTypingStop
		);
		for (const event of typingStopEvents) {
			streamingMessageStore.clearSession(event.pubkey);
		}

		// Clear streaming when final messages arrive
		const finalMessages = repliesSubscription.events.filter(e =>
			e.kind === NDKKind.GenericReply
		);
		for (const event of finalMessages) {
			streamingMessageStore.clearSession(event.pubkey);
			// Clear tracked streaming events for this pubkey
			streamingEvents
				.filter(e => e.pubkey === event.pubkey)
				.forEach(e => processedStreamingEvents.delete(e.id));
		}
	});

	const replies = $derived.by(() => {
		if (!repliesSubscription) return [];

		// Filter out streaming events from subscription - they're handled via global store
		const nonStreamingEvents = repliesSubscription.events.filter(e =>
			e.kind !== NDKKind.TenexStreamingResponse &&
			e.kind !== NDKKind.TenexAgentTypingStart &&
			e.kind !== NDKKind.TenexAgentTypingStop
		);

		// Process events through the unified processor
		const processedMessages = processEventsToMessages(
			nonStreamingEvents,
			currentEvent, // Use current event as the root for this thread level
			'threaded',
			false, // isBrainstorm
			false, // showAll
			ndk.$currentUser?.pubkey
		);

		// Add streaming messages from global store that are replies to THIS event
		const streamingSessions = Object.entries(streamingMessageStore.sessions);
		const streamingMessages: MessageType[] = [];

		for (const [key, session] of streamingSessions) {
			// Check if this streaming session is a reply to the current event
			const replyToTag = session.latestEvent.tags.find(t => t[0] === 'e');
			if (replyToTag && replyToTag[1] === currentEvent.id) {
				// Create synthetic event for this streaming reply
				const syntheticEvent = new NDKEvent(ndk);
				syntheticEvent.kind = NDKKind.TenexStreamingResponse;
				syntheticEvent.pubkey = session.latestEvent.pubkey;
				syntheticEvent.created_at = session.latestEvent.created_at;
				syntheticEvent.tags = session.latestEvent.tags;
				syntheticEvent.content = session.reconstructedContent;
				syntheticEvent.id = session.latestEvent.id;
				syntheticEvent.sig = session.latestEvent.sig;

				streamingMessages.push({
					id: session.syntheticId,
					event: syntheticEvent
				});
			}
		}

		// Combine and sort all messages
		const allMessages = [...processedMessages, ...streamingMessages].sort((a, b) =>
			(a.event.created_at || 0) - (b.event.created_at || 0)
		);

		return allMessages;
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
