<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import type { Message } from '$lib/utils/messageProcessor';
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';
	import { NDKEvent } from '@nostr-dev-kit/ndk';
	import { NDKKind } from '$lib/kinds';
	import { User } from '$lib/ndk/ui/user';
	import { NDKProject } from '$lib/events/NDKProject';
	import AIReasoningBlock from './AIReasoningBlock.svelte';
	import ToolCallContent from './ToolCallContent.svelte';
	import SuggestionButtons from './SuggestionButtons.svelte';
	import LLMMetadataDialog from './LLMMetadataDialog.svelte';
	import TypingIndicator from './TypingIndicator.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Copy, Reply, Quote, MoreVertical, Info, Eye, Hash } from 'lucide-svelte';
	import { performanceMetrics } from '$lib/stores/performance-metrics.svelte';
	import { formatTimestamp } from '$lib/utils/time';

	interface Props {
		message: Message;
		isLastMessage?: boolean;
		isConsecutive?: boolean;
		hasNextConsecutive?: boolean;
		onReply?: (message: Message) => void;
		onQuote?: (message: Message) => void;
		onTimeClick?: (event: NDKEvent) => void;
	}

	let { message, isLastMessage = false, isConsecutive = false, hasNextConsecutive = false, onReply, onQuote, onTimeClick }: Props = $props();

	const isStreaming = $derived(message.event.kind === NDKKind.TenexStreamingResponse);
	const isTyping = $derived(message.event.kind === NDKKind.TenexAgentTypingStart);
	const isReasoningEvent = $derived(message.event.hasTag('reasoning'));
	const isToolCallEvent = $derived(
		message.event.kind === NDKKind.GenericReply && message.event.hasTag('tool')
	);
	const hasSuggestions = $derived(message.event.tags?.some((tag) => tag[0] === 'suggestion'));

	// Track render performance
	$effect(() => {
		if (isStreaming && performanceMetrics.isEnabled) {
			const startTime = performance.now();

			// Trigger effect by accessing message content
			message.event.content;

			const renderTime = performance.now() - startTime;

			// Update metrics
			const currentMetrics = performanceMetrics.messageRenderMetrics;
			performanceMetrics.updateMessageRenderMetrics({
				renderCount: currentMetrics.renderCount + 1,
				totalRenderTime: currentMetrics.totalRenderTime + renderTime,
				lastRenderTime: renderTime,
				slowRenderCount: renderTime > 16 ? currentMetrics.slowRenderCount + 1 : currentMetrics.slowRenderCount
			});
		}
	});


	// Format timestamp
	const timestamp = $derived.by(() => {
		if (!message.event.created_at) return '';
		return formatTimestamp(message.event.created_at);
	});

	// Render markdown with sanitization
	const renderedContent = $derived.by(() => {
		if (isTyping) return message.event.content;
		try {
			const parseStart = performanceMetrics.isEnabled ? performance.now() : 0;
			const rawHtml = marked.parse(message.event.content || '') as string;
			const sanitized = DOMPurify.sanitize(rawHtml);

			if (performanceMetrics.isEnabled) {
				const parseTime = performance.now() - parseStart;
				const currentMetrics = performanceMetrics.messageRenderMetrics;
				performanceMetrics.updateMessageRenderMetrics({
					markdownParseTime: currentMetrics.markdownParseTime + parseTime
				});
			}

			return sanitized;
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
</script>

<div
	class="group px-4 py-1 hover:bg-muted/10 transition-colors"
>
	<div class="flex gap-3">
		<!-- Avatar or consecutive indicator -->
		{#if !isConsecutive}
			<User.Root {ndk} pubkey={message.event.pubkey}>
				<div class="flex-shrink-0 pt-0.5 relative">
					<User.Avatar class="w-9 h-9 rounded-md" />
				<!-- Line extending down from avatar if next message is consecutive -->
				{#if hasNextConsecutive}
					<div class="absolute left-1/2 -translate-x-1/2 top-9 bottom-0 border-l border-border/60"></div>
				{/if}
				</div>
			</User.Root>
		{:else}
			<div class="w-9 flex-shrink-0 relative">
				<!-- Border line on the left that extends the full height -->
				<div class="absolute left-1/2 -translate-x-1/2 inset-y-0 border-l border-border/60"></div>
				<!-- Dot indicator -->
				<div class="absolute left-1/2 -translate-x-1/2 top-2.5 w-1.5 h-1.5 bg-muted-foreground/80 rounded-full z-10"></div>
			</div>
		{/if}

		<!-- Message Content -->
		<div class="flex-1 min-w-0">
			<div class="text-xs text-muted-foreground font-mono mb-1">
				<span class="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
					kind:{message.event.kind}
				</span>
				<span class="ml-2">id:{message.event.id.slice(0, 8)}</span>
			</div>
			{#if !isConsecutive}
				<div class="flex items-center gap-2 mb-1">
					<User.Root {ndk} pubkey={message.event.pubkey}>
						<span class="font-semibold text-sm text-foreground"><User.Name /></span>
					</User.Root>
					<button
						type="button"
						onclick={() => {
							console.log('Timestamp clicked!', message.event.id);
							console.log('onTimeClick exists?', !!onTimeClick);
							onTimeClick?.(message.event);
						}}
						class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer hover:underline"
						title="Open as root conversation"
					>
						{timestamp}
					</button>

					<!-- P-tagged user avatars -->
					{#if replyingTo.length > 0}
						<div class="flex items-center -space-x-2">
							{#each replyingTo as pubkey (pubkey)}
								<User.Root {ndk} {pubkey}>
									<div class="relative">
										<User.Avatar class="w-5 h-5 ring-2 ring-white dark:ring-zinc-900" />
									</div>
								</User.Root>
							{/each}
						</div>
					{/if}

					<!-- Phase indicator -->
					{#if phaseInfo}
						<div class="flex items-center gap-1.5 text-xs">
							<svg class="w-3 h-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
							</svg>
							<span class="px-2 py-0.5 rounded bg-green-100 text-green-700 font-medium uppercase text-[10px] tracking-wide">
								{phaseInfo}
							</span>
						</div>
					{/if}

					{#if isStreaming}
						<span class="text-xs text-primary flex items-center gap-1">
							<span class="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
							streaming...
						</span>
					{/if}
					{#if isTyping}
						<TypingIndicator />
					{/if}

					<!-- Message Actions Dropdown -->
					<div class="ml-auto transition-opacity" class:opacity-0={!dropdownOpen} class:opacity-100={dropdownOpen} class:group-hover:opacity-100={!dropdownOpen}>
						<DropdownMenu.Root bind:open={dropdownOpen}>
							<DropdownMenu.Trigger
								type="button"
								class="p-1 rounded hover:bg-secondary transition-colors"
								aria-label="Message actions"
							>
								<MoreVertical class="w-4 h-4 text-muted-foreground" />
							</DropdownMenu.Trigger>
							<DropdownMenu.Content align="end" class="w-48">
								<DropdownMenu.Item onclick={() => onReply?.(message)}>
									<Reply class="mr-2 h-4 w-4" />
									<span>Reply</span>
								</DropdownMenu.Item>
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
								<DropdownMenu.Item onclick={() => navigator.clipboard.writeText(message.event.encode())}>
									<Hash class="mr-2 h-4 w-4" />
									<span>Copy ID</span>
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
			{/if}

			<!-- Render content based on type -->
			<div class:flex={isConsecutive} class:items-start={isConsecutive} class:justify-between={isConsecutive} class:gap-4={isConsecutive}>
				<div class="flex-1">
					{#if isTyping}
						<!-- Typing indicator is shown in the header, no content needed -->
					{:else if isToolCallEvent}
						<ToolCallContent event={message.event} />
					{:else if isReasoningEvent}
						<AIReasoningBlock
							reasoningEvent={message.event}
							{isStreaming}
							{isLastMessage}
						/>
					{:else}
						<div class="prose prose-sm text-sm max-w-none dark:prose-invert text-foreground">
							{@html renderedContent}
							{#if isStreaming}
								<span class="inline-block w-1.5 h-4 ml-0.5 bg-primary animate-pulse"></span>
							{/if}
						</div>

						<!-- Render suggestion buttons if they exist -->
						{#if hasSuggestions}
							<SuggestionButtons event={message.event} />
						{/if}
					{/if}
				</div>

				<!-- Compact header for consecutive messages -->
				{#if isConsecutive}
					<div class="flex items-center gap-2 flex-shrink-0 sticky top-0">
						<button
							type="button"
							onclick={() => {
								onTimeClick?.(message.event);
							}}
							class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer hover:underline"
							title="Open as root conversation"
						>
							{timestamp}
						</button>

						<!-- Message Actions Dropdown -->
						<div class="transition-opacity" class:opacity-0={!dropdownOpen} class:opacity-100={dropdownOpen} class:group-hover:opacity-100={!dropdownOpen}>
							<DropdownMenu.Root bind:open={dropdownOpen}>
								<DropdownMenu.Trigger
									type="button"
									class="p-1 rounded hover:bg-secondary transition-colors"
									aria-label="Message actions"
								>
									<MoreVertical class="w-4 h-4 text-muted-foreground" />
								</DropdownMenu.Trigger>
								<DropdownMenu.Content align="end" class="w-48">
									<DropdownMenu.Item onclick={() => onReply?.(message)}>
										<Reply class="mr-2 h-4 w-4" />
										<span>Reply</span>
									</DropdownMenu.Item>
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
									<DropdownMenu.Item onclick={() => navigator.clipboard.writeText(message.event.encode())}>
										<Hash class="mr-2 h-4 w-4" />
										<span>Copy ID</span>
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
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- Raw Event Dialog -->
{#if showRawEvent}
	<div
		class="fixed inset-0 bg-overlay/50 dark:bg-overlay/70 flex items-center justify-center z-50"
		onclick={closeRawEventDialog}
		onkeydown={(e) => {
			if (e.key === 'Escape') closeRawEventDialog();
		}}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<div
			class="bg-card rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col"
			onclick={(e) => e.stopPropagation()}
			role="document"
		>
			<div class="flex items-center justify-between px-4 py-3 border-b border-border">
				<h3 class="font-semibold text-foreground">Raw Event</h3>
				<button
					type="button"
					onclick={closeRawEventDialog}
					class="p-1 rounded hover:bg-muted transition-colors"
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
					class="text-xs bg-muted text-foreground rounded p-4 overflow-x-auto">{JSON.stringify(message.event.rawEvent(), null, 2)}</pre>
			</div>
			<div class="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
				<button
					type="button"
					onclick={() => {
						navigator.clipboard.writeText(JSON.stringify(message.event.rawEvent(), null, 2));
					}}
					class="px-3 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 dark:hover:bg-primary transition-colors"
				>
					Copy JSON
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- LLM Metadata Dialog -->
<LLMMetadataDialog bind:open={showLLMMetadata} event={message.event} />
