<script lang="ts">
	import type { ThreadedMessage } from '$lib/utils/threadBuilder';
	import Message from './Message.svelte';

	interface Props {
		message: ThreadedMessage;
		maxDepth?: number;
	}

	let { message, maxDepth = 5 }: Props = $props();

	// Limit nesting depth to prevent extreme indentation
	const depth = $derived(Math.min(message.depth, maxDepth));
	const hasReplies = $derived(message.replies.length > 0);
</script>

<div class="threaded-message-container">
	<!-- Current Message -->
	<div
		class="relative"
		style="padding-left: {depth * 16}px"
	>
		<!-- Thread Line (connecting to parent) -->
		{#if depth > 0}
			<div
				class="absolute top-0 bottom-0 w-0.5 bg-gray-200"
				style="left: {(depth - 1) * 16 + 12}px"
			></div>
		{/if}

		<!-- Message Content -->
		<div class="relative">
			{#if depth > 0}
				<!-- Reply indicator dot -->
				<div
					class="absolute w-2 h-2 rounded-full bg-gray-300"
					style="left: -{depth * 16 - 4}px; top: 20px;"
				></div>
			{/if}

			<Message message={message} />
		</div>
	</div>

	<!-- Nested Replies -->
	{#if hasReplies}
		<div class="replies">
			{#each message.replies as reply (reply.id)}
				<svelte:self message={reply} {maxDepth} />
			{/each}
		</div>
	{/if}
</div>

<style>
	.threaded-message-container {
		position: relative;
	}

	.replies {
		position: relative;
	}
</style>
