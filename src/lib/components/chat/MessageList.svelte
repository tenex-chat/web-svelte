<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import Message from './Message.svelte';
	import ThreadedMessage from './ThreadedMessage.svelte';
	import { processEventsToMessages } from '$lib/utils/messageProcessor';
	import { buildMessageTree, flattenMessageTree } from '$lib/utils/threadBuilder';

	interface Props {
		rootEvent: NDKEvent;
		viewMode?: 'threaded' | 'flattened';
		isBrainstorm?: boolean;
	}

	let { rootEvent, viewMode = 'threaded', isBrainstorm = false }: Props = $props();

	const currentUser = $derived(ndk.$sessions.currentUser);

	// Subscribe to all messages in this conversation
	const messagesSubscription = ndk.$subscribe(() => ({
		filters: [
			{
				kinds: [11, 1111, 7, 21111, 513],
				...rootEvent.filter()
			},
			rootEvent.nip22Filter()
		],
		closeOnEose: false,
		bufferMs: 30
	}));

	// Process raw events into flat messages with streaming support
	const flatMessages = $derived.by(() => {
		return processEventsToMessages(
			messagesSubscription.events,
			rootEvent,
			'flattened', // Always process as flattened first
			isBrainstorm,
			false, // showAll
			currentUser?.pubkey
		);
	});

	// Build message tree for threaded view
	const messageTree = $derived.by(() => {
		if (viewMode === 'threaded') {
			return buildMessageTree(flatMessages, rootEvent);
		}
		return [];
	});

	// Flatten tree for flattened view
	const displayMessages = $derived.by(() => {
		if (viewMode === 'threaded') {
			return [];
		}
		return flatMessages;
	});
</script>

<div class="flex-1 overflow-y-auto">
	{#if flatMessages.length === 0}
		<div class="flex items-center justify-center h-full text-gray-500 text-sm">
			No messages yet. Start the conversation!
		</div>
	{:else if viewMode === 'threaded'}
		<div class="flex flex-col">
			{#each messageTree as message (message.id)}
				<ThreadedMessage {message} />
			{/each}
		</div>
	{:else}
		<div class="flex flex-col">
			{#each displayMessages as message (message.id)}
				<Message {message} />
			{/each}
		</div>
	{/if}
</div>
