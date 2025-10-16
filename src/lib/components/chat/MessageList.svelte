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
		messages?: Message[];
	}

	let {
		rootEvent,
		viewMode = 'threaded',
		isBrainstorm = false,
		onReply,
		onQuote,
		messages = $bindable([])
	}: Props = $props();

	const currentUser = $derived(ndk.$sessions.currentUser);

	// Subscribe to all messages in this conversation
	// Use rootEvent.filter() and nip22Filter() directly - they include all necessary kinds
	const messagesSubscription = ndk.$subscribe(() => ({
		filters: isBrainstorm
			? [
					{ kinds: [1111, 7], ...rootEvent.filter() },
					{ kinds: [1111, 7], ...rootEvent.nip22Filter() }
				]
			: [rootEvent.filter(), rootEvent.nip22Filter()],
		closeOnEose: false,
		bufferMs: 30
	}));

	// Process raw events into flat messages with streaming support
	const flatMessages = $derived.by(() => {
		// Always include the root event (kind 11) as the first message
		// The subscription filter doesn't return it because it looks for events that reference the root
		const allEvents = messagesSubscription.events.some((e) => e.id === rootEvent.id)
			? messagesSubscription.events
			: [rootEvent, ...messagesSubscription.events];

		return processEventsToMessages(
			allEvents,
			rootEvent,
			'flattened', // Always process as flattened first
			isBrainstorm,
			false, // showAll
			currentUser?.pubkey
		);
	});

	// Sync flatMessages to bindable messages prop
	$effect(() => {
		messages = flatMessages;
	});
</script>

<div class="flex-1 overflow-y-auto">
	{#if flatMessages.length === 0}
		<div class="flex items-center justify-center h-full text-muted-foreground text-sm">
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
