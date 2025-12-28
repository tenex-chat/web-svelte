<script lang="ts">
	import type { Message } from '$lib/utils/messageUtils';
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import { ndk } from '$lib/ndk.svelte';
	import { User } from '$lib/ndk/ui/user';
	import { Streamdown } from 'svelte-streamdown';
	import { ChevronDown, ChevronRight } from 'lucide-svelte';
	import { slide } from 'svelte/transition';
	import { aggregateTodoState, type AggregatedTodoState } from '$lib/utils/todoAggregator';
	import AgentTodoList from './AgentTodoList.svelte';
	import ToolRenderer from './tools/ToolRenderer.svelte';
	import AIReasoningBlock from './AIReasoningBlock.svelte';
	import { formatTimestamp } from '$lib/utils/time';

	interface Props {
		messages: Message[];
		isConsecutive: boolean;
		hasNextConsecutive: boolean;
		onReply?: (message: Message) => void;
		onQuote?: (message: Message) => void;
		onTimeClick?: (event: NDKEvent) => void;
	}

	let { messages, isConsecutive, hasNextConsecutive, onReply, onQuote, onTimeClick }: Props = $props();

	let isExpanded = $state(false);

	// Get agent pubkey from first message
	const agentPubkey = $derived(messages[0]?.event.pubkey);

	// Aggregate todo state from all messages
	const todoState = $derived<AggregatedTodoState>(
		aggregateTodoState(messages.map(m => m.event))
	);

	// Classify messages
	function isToolCall(msg: Message): boolean {
		return msg.event.hasTag('tool');
	}

	function hasReasoningTag(msg: Message): boolean {
		return msg.event.tags?.some((tag) => tag[0] === 'reasoning') ?? false;
	}

	// Get the last 2 messages (any type) to always show
	const lastTwoMessages = $derived(messages.slice(-2));

	// Collapsed messages count (everything except last 2)
	const collapsedCount = $derived(Math.max(0, messages.length - 2));

	// All collapsed items (for expanded view)
	const collapsedMessages = $derived(messages.slice(0, -2));

	function toggleExpanded() {
		isExpanded = !isExpanded;
	}

	// Get tool name from event
	function getToolName(event: NDKEvent): string | undefined {
		const toolTag = event.tags?.find((tag) => tag[0] === 'tool');
		return toolTag?.[1];
	}
</script>

<div class="px-4 py-1">
	<div class="flex gap-3">
		<!-- Avatar column -->
		{#if isConsecutive}
			<div class="w-9 flex-shrink-0 relative">
				<div class="absolute left-1/2 -translate-x-1/2 inset-y-0 border-l border-border/60"></div>
			</div>
		{:else}
			<div class="w-9 flex-shrink-0 relative">
				{#if agentPubkey}
					<User.Root {ndk} pubkey={agentPubkey}>
						<User.Avatar class="w-9 h-9 rounded-full" />
					</User.Root>
				{/if}
				{#if hasNextConsecutive}
					<div class="absolute left-1/2 -translate-x-1/2 top-9 bottom-0 border-l border-border/60"></div>
				{/if}
			</div>
		{/if}

		<!-- Content -->
		<div class="flex-1 min-w-0">
			<!-- Agent name (if not consecutive) -->
			{#if !isConsecutive && agentPubkey}
				<div class="flex items-center gap-2 mb-1">
					<User.Root {ndk} pubkey={agentPubkey}>
						<User.Name class="text-sm font-medium text-foreground" />
					</User.Root>
				</div>
			{/if}

			<!-- Todo list at top (if any) -->
			{#if todoState.hasTodos}
				<div class="mb-3">
					<AgentTodoList items={todoState.items} />
				</div>
			{/if}

			<!-- Vertical timeline -->
			<div class="relative">
				<!-- Collapsed messages indicator -->
				{#if collapsedCount > 0}
					<div class="flex items-center gap-2 mb-2">
						<div class="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full"></div>
						<button
							type="button"
							onclick={toggleExpanded}
							class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
						>
							{#if isExpanded}
								<ChevronDown class="w-3 h-3" />
							{:else}
								<ChevronRight class="w-3 h-3" />
							{/if}
							<span>{collapsedCount} message{collapsedCount !== 1 ? 's' : ''}</span>
						</button>
					</div>

					<!-- Expanded collapsed messages -->
					{#if isExpanded}
						<div transition:slide={{ duration: 200 }} class="ml-4 mb-3 space-y-2 border-l-2 border-border/40 pl-3">
							{#each collapsedMessages as msg (msg.id)}
								{@const toolName = getToolName(msg.event)}
								<div class="text-sm">
									{#if hasReasoningTag(msg)}
										<AIReasoningBlock
											reasoningEvent={msg.event}
											isLastMessage={false}
											timestamp={msg.event.created_at ? formatTimestamp(msg.event.created_at) : ''}
											message={msg}
											{onReply}
											{onQuote}
											{onTimeClick}
										/>
									{:else if toolName}
										<ToolRenderer event={msg.event} />
									{:else}
										<div class="prose prose-sm text-sm max-w-none dark:prose-invert text-muted-foreground">
											<Streamdown
												content={msg.event.content}
												class="prose prose-sm text-sm max-w-none dark:prose-invert text-muted-foreground"
												parseIncompleteMarkdown={true}
												animation={{ enabled: false }}
												baseTheme="shadcn"
												shikiTheme="github-dark-dimmed"
											/>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				{/if}

				<!-- Always visible: last 2 messages -->
				{#each lastTwoMessages as msg, idx (msg.id)}
					{@const isLast = idx === lastTwoMessages.length - 1}
					{@const toolName = getToolName(msg.event)}
					<div class="flex items-start gap-2 {idx > 0 ? 'mt-2' : ''}">
						<div class="w-1.5 h-1.5 bg-muted-foreground/80 rounded-full mt-2 flex-shrink-0"></div>
						<div class="flex-1 min-w-0">
							{#if hasReasoningTag(msg)}
								<AIReasoningBlock
									reasoningEvent={msg.event}
									isLastMessage={isLast}
									timestamp={msg.event.created_at ? formatTimestamp(msg.event.created_at) : ''}
									message={msg}
									{onReply}
									{onQuote}
									{onTimeClick}
								/>
							{:else if toolName}
								<ToolRenderer event={msg.event} />
								{#if isLast && msg.event.created_at}
									<button
										type="button"
										onclick={() => onTimeClick?.(msg.event)}
										class="text-xs text-muted-foreground hover:text-foreground hover:underline mt-1"
									>
										{formatTimestamp(msg.event.created_at)}
									</button>
								{/if}
							{:else}
								<div class="prose prose-sm text-sm max-w-none dark:prose-invert text-foreground">
									<Streamdown
										content={msg.event.content}
										class="prose prose-sm text-sm max-w-none dark:prose-invert text-foreground"
										parseIncompleteMarkdown={true}
										animation={{ enabled: false }}
										baseTheme="shadcn"
										shikiTheme="github-dark-dimmed"
									/>
								</div>
								{#if isLast && msg.event.created_at}
									<button
										type="button"
										onclick={() => onTimeClick?.(msg.event)}
										class="text-xs text-muted-foreground hover:text-foreground hover:underline mt-1"
									>
										{formatTimestamp(msg.event.created_at)}
									</button>
								{/if}
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>
