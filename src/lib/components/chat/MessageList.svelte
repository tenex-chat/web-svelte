<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import Message from './Message.svelte';
	import ThreadedMessage from './ThreadedMessage.svelte';
	import { processEventsToMessages } from '$lib/utils/messageProcessor';

	interface Props {
		rootEvent: NDKEvent;
		viewMode?: 'threaded' | 'flattened';
		isBrainstorm?: boolean;
		onReply?: (message: Message) => void;
		onQuote?: (message: Message) => void;
	}

	let {
		rootEvent,
		viewMode = 'threaded',
		isBrainstorm = false,
		onReply,
		onQuote
	}: Props = $props();

	const currentUser = $derived(ndk.$sessions.currentUser);

	// Subscribe to all messages in this conversation
	const messagesSubscription = ndk.$subscribe(() => {
		const filter1 = {
			kinds: [11, 1111, 7, 21111, 513],
			...rootEvent.filter()
		};
		const filter2 = rootEvent.nip22Filter();

		console.log('[MessageList] Subscription filters:', {
			filter1,
			filter2,
			rootEventId: rootEvent.id,
			viewMode
		});

		return {
			filters: [filter1, filter2],
			closeOnEose: false,
			bufferMs: 30
		};
	});

	// Process raw events into flat messages with streaming support
	const flatMessages = $derived.by(() => {
		console.log('[MessageList] Raw subscription events:', {
			count: messagesSubscription.events.length,
			eventIds: messagesSubscription.events.map((e) => ({ id: e.id.slice(0, 8), kind: e.kind })),
			hasRootEvent: messagesSubscription.events.some((e) => e.id === rootEvent.id)
		});

		// Always include the root event (kind 11) as the first message
		// The subscription filter doesn't return it because it looks for events that reference the root
		const allEvents = messagesSubscription.events.some((e) => e.id === rootEvent.id)
			? messagesSubscription.events
			: [rootEvent, ...messagesSubscription.events];

		console.log('[MessageList] All events (with root):', {
			count: allEvents.length,
			eventIds: allEvents.map((e) => ({ id: e.id.slice(0, 8), kind: e.kind }))
		});

		const processed = processEventsToMessages(
			allEvents,
			rootEvent,
			'flattened', // Always process as flattened first
			isBrainstorm,
			false, // showAll
			currentUser?.pubkey
		);

		console.log('[MessageList] Processed flat messages:', {
			count: processed.length,
			messageIds: processed.map((m) => ({ id: m.id.slice(0, 8), kind: m.event.kind }))
		});

		return processed;
	});
</script>

<div class="flex-1 overflow-y-auto">
	{#if flatMessages.length === 0}
		<div class="flex items-center justify-center h-full text-gray-500 dark:text-gray-400 text-sm">
			No messages yet. Start the conversation!
		</div>
	{:else if viewMode === 'threaded'}
		<!-- Threaded view: Use recursive ThreadedMessage component -->
		<div class="flex flex-col">
			<ThreadedMessage {rootEvent} eventId={rootEvent.id} depth={0} />
		</div>
	{:else}
		<!-- Flattened view: Render messages in chronological order -->
		<div class="flex flex-col">
			{#each flatMessages as message, index (message.id)}
				<Message
					{message}
					isLastMessage={index === flatMessages.length - 1}
					{onReply}
					{onQuote}
				/>
			{/each}
		</div>
	{/if}
</div>
