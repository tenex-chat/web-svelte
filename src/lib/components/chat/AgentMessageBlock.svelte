<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import Message from './Message.svelte';
	import AgentTodoList from './AgentTodoList.svelte';
	import { type Message as MessageType } from '$lib/utils/messageUtils';
	import { aggregateTodoState } from '$lib/utils/todoAggregator';
	import { ChevronDown, ChevronRight } from 'lucide-svelte';
	import { slide } from 'svelte/transition';

	interface Props {
		messages: MessageType[];
		isConsecutive?: boolean;
		hasNextConsecutive?: boolean;
		isLastInParent?: boolean;
		onReply?: (message: MessageType) => void;
		onQuote?: (message: MessageType) => void;
		onTimeClick?: (event: NDKEvent) => void;
	}

	let {
		messages,
		isConsecutive = false,
		hasNextConsecutive = false,
		isLastInParent = false,
		onReply,
		onQuote,
		onTimeClick
	}: Props = $props();

	// Track which groups are expanded (by first message ID)
	let expandedGroups = $state(new Set<string>());

	function toggleGroup(groupKey: string) {
		if (expandedGroups.has(groupKey)) {
			expandedGroups.delete(groupKey);
		} else {
			expandedGroups.add(groupKey);
		}
		expandedGroups = new Set(expandedGroups);
	}

	// Compute derived values
	const groupKey = $derived(messages[0]?.id || 'unknown');
	const isExpanded = $derived(expandedGroups.has(groupKey));
	const firstMessage = $derived(messages[0]);
	const lastVisibleCount = 2;
	// Exclude firstMessage from lastMessages to prevent duplicates for small groups
	const lastMessages = $derived(
		messages.length > lastVisibleCount ? messages.slice(-lastVisibleCount) : messages.slice(1)
	);
	const middleMessages = $derived(messages.slice(1, -lastVisibleCount));
	const collapsibleCount = $derived(middleMessages.length);
	const todoState = $derived(aggregateTodoState(messages.map(m => m.event)));
</script>

{#if messages.length > 0}
	<div>
		<!-- 1. First message (establishes who's speaking) -->
		<Message
			message={firstMessage}
			isLastMessage={false}
			{isConsecutive}
			hasNextConsecutive={true}
			{onReply}
			{onQuote}
			{onTimeClick}
		/>

		<!-- 2. Todo list (if any) -->
		{#if todoState.hasTodos}
			<div class="px-4 py-1">
				<div class="flex gap-3">
					<div class="w-9 flex-shrink-0"></div>
					<div class="flex-1">
						<AgentTodoList items={todoState.items} />
					</div>
				</div>
			</div>
		{/if}

		<!-- 3. Collapse/expand button (for middle messages) -->
		{#if collapsibleCount > 0}
			<div class="px-4 py-1">
				<div class="flex gap-3">
					<div class="w-9 flex-shrink-0"></div>
					<button
						type="button"
						onclick={() => toggleGroup(groupKey)}
						class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
					>
						{#if isExpanded}
							<ChevronDown class="w-3 h-3" />
							<span>Collapse {collapsibleCount} message{collapsibleCount !== 1 ? 's' : ''}</span>
						{:else}
							<ChevronRight class="w-3 h-3" />
							<span>{collapsibleCount} message{collapsibleCount !== 1 ? 's' : ''}</span>
						{/if}
					</button>
				</div>
			</div>
		{/if}

		<!-- 4. Middle messages (when expanded) -->
		{#if isExpanded && collapsibleCount > 0}
			{#each middleMessages as msg (msg.id)}
				<div transition:slide={{ duration: 150 }}>
					<Message
						message={msg}
						isLastMessage={false}
						isConsecutive={true}
						hasNextConsecutive={true}
						{onReply}
						{onQuote}
						{onTimeClick}
					/>
				</div>
			{/each}
		{/if}

		<!-- 5. Last message(s) always visible -->
		{#each lastMessages as msg, msgIdx (msg.id)}
			{@const isLastInGroup = msgIdx === lastMessages.length - 1}
			<Message
				message={msg}
				isLastMessage={isLastInGroup && isLastInParent}
				isConsecutive={true}
				hasNextConsecutive={!isLastInGroup || hasNextConsecutive}
				{onReply}
				{onQuote}
				{onTimeClick}
			/>
		{/each}
	</div>
{/if}
