<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import type { Message } from '$lib/utils/messageProcessor';
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';
	import { EVENT_KINDS } from '$lib/constants';
	import { NDKKind, NDKEvent } from '@nostr-dev-kit/ndk';
	import { Avatar } from '@nostr-dev-kit/svelte';
	import { NDKProject } from '$lib/events/NDKProject';
	import AIReasoningBlock from './AIReasoningBlock.svelte';
	import ToolCallContent from './ToolCallContent.svelte';
	import SuggestionButtons from './SuggestionButtons.svelte';
	import LLMMetadataDialog from './LLMMetadataDialog.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Copy, Reply, Quote, FileJson, MoreVertical, Info, Eye } from 'lucide-svelte';

	interface Props {
		message: Message;
		isLastMessage?: boolean;
		onReply?: (message: Message) => void;
		onQuote?: (message: Message) => void;
	}

	let { message, isLastMessage = false, onReply, onQuote }: Props = $props();

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

	// Get p-tags (users being replied to)
	const replyingTo = $derived.by(() => {
		const pTags = message.event.tags.filter((tag) => tag[0] === 'p');
		return pTags.map((tag) => tag[1]).filter(Boolean);
	});

	// Get phase information
	const phaseInfo = $derived.by(() => {
		const phaseTag = message.event.tags.find((tag) => tag[0] === 'phase');
		return phaseTag ? phaseTag[1] : null;
	});

	let dropdownOpen = $state(false);
	let showRawEvent = $state(false);
	let showLLMMetadata = $state(false);

	function closeRawEventDialog() {
		showRawEvent = false;
	}

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
	class="group px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
>
	<div class="flex gap-3">
		<!-- Avatar -->
		<Avatar {ndk} pubkey={message.event.pubkey} size={32} />

		<!-- Message Content -->
		<div class="flex-1 min-w-0">
			<div class="flex items-center gap-2 mb-1">
				<span class="font-semibold text-sm text-gray-900 dark:text-gray-100">{authorName}</span>
				<span class="text-xs text-gray-600 dark:text-gray-300">{timestamp}</span>

				<!-- P-tagged user avatars -->
				{#if replyingTo.length > 0}
					<div class="flex items-center -space-x-2">
						{#each replyingTo as pubkey (pubkey)}
							<div class="relative">
								<Avatar {ndk} {pubkey} size={20} class="ring-2 ring-white dark:ring-zinc-900" />
							</div>
						{/each}
					</div>
				{/if}

				<!-- Phase indicator -->
				{#if phaseInfo}
					<div class="flex items-center gap-1.5 text-xs">
						<svg class="w-3 h-3 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
						</svg>
						<span class="px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium uppercase text-[10px] tracking-wide">
							{phaseInfo}
						</span>
					</div>
				{/if}

				{#if isStreaming}
					<span class="text-xs text-blue-600 dark:text-blue-300 flex items-center gap-1">
						<span class="inline-block w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-300 animate-pulse"></span>
						streaming...
					</span>
				{/if}
				{#if isTyping}
					<span class="text-xs text-gray-600 dark:text-gray-300 italic">typing...</span>
				{/if}

				<!-- Message Actions Dropdown -->
				<div class="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
					<DropdownMenu.Root bind:open={dropdownOpen}>
						<DropdownMenu.Trigger asChild>
							<button
								type="button"
								class="p-1 rounded hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
								aria-label="Message actions"
							>
								<MoreVertical class="w-4 h-4 text-gray-500 dark:text-gray-400" />
							</button>
						</DropdownMenu.Trigger>
						<DropdownMenu.Content align="end" class="w-48">
							{#if onReply}
								<DropdownMenu.Item onclick={() => onReply?.(message)}>
									<Reply class="mr-2 h-4 w-4" />
									<span>Reply</span>
								</DropdownMenu.Item>
							{/if}
							{#if onQuote}
								<DropdownMenu.Item onclick={() => onQuote?.(message)}>
									<Quote class="mr-2 h-4 w-4" />
									<span>Quote</span>
								</DropdownMenu.Item>
							{/if}
							<DropdownMenu.Item onclick={() => navigator.clipboard.writeText(message.event.content)}>
								<Copy class="mr-2 h-4 w-4" />
								<span>Copy content</span>
							</DropdownMenu.Item>
							<DropdownMenu.Separator />
							<DropdownMenu.Item onclick={() => (showLLMMetadata = true)}>
								<Info class="mr-2 h-4 w-4" />
								<span>View LLM metadata</span>
							</DropdownMenu.Item>
							<DropdownMenu.Item onclick={() => (showRawEvent = true)}>
								<Eye class="mr-2 h-4 w-4" />
								<span>View raw event</span>
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				</div>
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
				<div class="prose prose-sm max-w-none dark:prose-invert text-gray-900 dark:text-gray-100">
					{@html renderedContent}
					{#if isStreaming}
						<span class="inline-block w-1.5 h-4 ml-0.5 bg-blue-600 dark:bg-blue-400 animate-pulse"></span>
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

<!-- Raw Event Dialog -->
{#if showRawEvent}
	<div
		class="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50"
		onclick={closeRawEventDialog}
		onkeydown={(e) => {
			if (e.key === 'Escape') closeRawEventDialog();
		}}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<div
			class="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col"
			onclick={(e) => e.stopPropagation()}
			role="document"
		>
			<div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-zinc-700">
				<h3 class="font-semibold text-gray-900 dark:text-gray-100">Raw Event</h3>
				<button
					type="button"
					onclick={closeRawEventDialog}
					class="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
					aria-label="Close"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>
			<div class="flex-1 overflow-y-auto p-4">
				<pre
					class="text-xs bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-gray-100 rounded p-4 overflow-x-auto">{JSON.stringify(message.event.rawEvent(), null, 2)}</pre>
			</div>
			<div class="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-zinc-700">
				<button
					type="button"
					onclick={() => {
						navigator.clipboard.writeText(JSON.stringify(message.event.rawEvent(), null, 2));
					}}
					class="px-3 py-2 text-sm bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
				>
					Copy JSON
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- LLM Metadata Dialog -->
{#if showLLMMetadata}
	<LLMMetadataDialog event={message.event} onClose={() => (showLLMMetadata = false)} />
{/if}
