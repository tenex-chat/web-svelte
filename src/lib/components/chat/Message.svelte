<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import type { Message } from '$lib/utils/messageProcessor';
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';
	import { EVENT_KINDS } from '$lib/constants';
	import { NDKKind, NDKEvent } from '@nostr-dev-kit/ndk';
	import { NDKProject } from '$lib/events/NDKProject';
	import AIReasoningBlock from './AIReasoningBlock.svelte';
	import ToolCallContent from './ToolCallContent.svelte';
	import SuggestionButtons from './SuggestionButtons.svelte';

	interface Props {
		message: Message;
		isLastMessage?: boolean;
	}

	let { message, isLastMessage = false }: Props = $props();

	const currentUser = $derived(ndk.$sessions.currentUser);
	const isCurrentUser = $derived(message.event.pubkey === currentUser?.pubkey);
	const isStreaming = $derived(message.event.kind === EVENT_KINDS.STREAMING_RESPONSE);
	const isTyping = $derived(message.event.kind === EVENT_KINDS.TYPING_INDICATOR);
	const isReasoningEvent = $derived(message.event.hasTag('reasoning'));
	const isToolCallEvent = $derived(
		message.event.kind === NDKKind.GenericReply && message.event.hasTag('tool')
	);
	const hasSuggestions = $derived(message.event.tags?.some((tag) => tag[0] === 'suggestion'));

	// Get author profile
	const author = $derived.by(() => {
		const user = ndk.getUser({ pubkey: message.event.pubkey });
		return user;
	});

	// Fetch profile
	const profile = ndk.$fetchProfile(() => message.event.pubkey);

	const authorName = $derived(
		profile?.displayName || profile?.name || message.event.pubkey.slice(0, 8)
	);

	// Format timestamp
	const timestamp = $derived.by(() => {
		if (!message.event.created_at) return '';
		const date = new Date(message.event.created_at * 1000);
		return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
	});

	// Render markdown with sanitization
	const renderedContent = $derived.by(() => {
		if (isTyping) return message.event.content;
		try {
			const rawHtml = marked(message.event.content || '');
			return DOMPurify.sanitize(rawHtml);
		} catch {
			return message.event.content || '';
		}
	});

	// Handle suggestion click - create kind:1111 reply
	async function handleSuggestionClick(suggestion: string, _index: number) {
		if (!currentUser) {
			alert('Unable to send response. Please ensure you are logged in.');
			return;
		}

		try {
			// Create a kind:1111 (GenericReply) event with the selected suggestion as content
			const replyEvent = new NDKEvent(ndk);
			replyEvent.kind = NDKKind.GenericReply;
			replyEvent.content = suggestion;

			// Add necessary tags for the reply
			replyEvent.tags = [
				['e', message.event.id] // Reply to the event with suggestions
			];

			// Add p-tag for the author of the original event
			replyEvent.tags.push(['p', message.event.pubkey]);

			// If this is in a project context, add the project tag
			const projectTag = message.event.tags.find(
				(tag) => tag[0] === 'a' && tag[1]?.startsWith(NDKProject.kind.toString())
			);
			if (projectTag) {
				replyEvent.tags.push(projectTag);
			}

			// Sign and publish the event
			await replyEvent.sign();
			await replyEvent.publish();

			console.log('Suggestion response sent:', suggestion);
		} catch (error) {
			console.error('Failed to send suggestion response:', error);
			alert('Failed to send response. Please try again.');
		}
	}
</script>

<div
	class="px-4 py-3 hover:bg-gray-50 transition-colors {isCurrentUser ? 'bg-blue-50/30' : ''}"
>
	<div class="flex gap-3">
		<!-- Avatar -->
		<div
			class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
		>
			{authorName.charAt(0).toUpperCase()}
		</div>

		<!-- Message Content -->
		<div class="flex-1 min-w-0">
			<div class="flex items-baseline gap-2 mb-1">
				<span class="font-semibold text-sm text-gray-900">{authorName}</span>
				<span class="text-xs text-gray-500">{timestamp}</span>
				{#if isStreaming}
					<span class="text-xs text-blue-600 flex items-center gap-1">
						<span class="inline-block w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
						streaming...
					</span>
				{/if}
				{#if isTyping}
					<span class="text-xs text-gray-500 italic">typing...</span>
				{/if}
			</div>

			<!-- Render content based on type -->
			{#if isToolCallEvent}
				<ToolCallContent event={message.event} />
			{:else if isReasoningEvent}
				<AIReasoningBlock
					reasoningEvent={message.event}
					{isStreaming}
					{isLastMessage}
				/>
			{:else}
				<div class="prose prose-sm max-w-none">
					{@html renderedContent}
					{#if isStreaming}
						<span class="inline-block w-1.5 h-4 ml-0.5 bg-blue-600 animate-pulse"></span>
					{/if}
				</div>

				<!-- Render suggestion buttons if they exist -->
				{#if hasSuggestions}
					<SuggestionButtons
						event={message.event}
						onSuggestionClick={handleSuggestionClick}
					/>
				{/if}
			{/if}
		</div>
	</div>
</div>
