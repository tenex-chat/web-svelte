<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import Message from './Message.svelte';
	import AgentTodoList from './AgentTodoList.svelte';
	import AgentMessageBlock from './AgentMessageBlock.svelte';
	import { type Message as MessageType } from '$lib/utils/messageUtils';
	import { aggregateTodoState } from '$lib/utils/todoAggregator';
	import { ChevronDown, ChevronRight } from 'lucide-svelte';
	import { slide } from 'svelte/transition';

	interface Props {
		messages: MessageType[];
		repliesByParent: Map<string, MessageType[]>;
		rootEventId: string;
		isConsecutive?: boolean;
		hasNextConsecutive?: boolean;
		isNested?: boolean;
		isLastInParent?: boolean;
		onReply?: (message: MessageType) => void;
		onQuote?: (message: MessageType) => void;
		onTimeClick?: (event: NDKEvent) => void;
	}

	let {
		messages,
		repliesByParent,
		rootEventId,
		isConsecutive = false,
		hasNextConsecutive = false,
		isNested = false,
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
	// For nested blocks, show only last 1 message; for root level, show last 2
	const lastVisibleCount = $derived(isNested ? 1 : 2);
	// Exclude firstMessage from lastMessages to prevent duplicates for small groups
	const lastMessages = $derived(
		messages.length > lastVisibleCount ? messages.slice(-lastVisibleCount) : messages.slice(1)
	);
	const middleMessages = $derived(messages.slice(1, -lastVisibleCount));
	const collapsibleCount = $derived(middleMessages.length);
	const todoState = $derived(aggregateTodoState(messages.map(m => m.event)));

	// Get replies for a specific message (excluding root level replies)
	function getRepliesFor(messageId: string): MessageType[] {
		if (messageId === rootEventId) return []; // Root replies are siblings, not nested
		return repliesByParent.get(messageId) || [];
	}

	// Group replies by author for nested rendering
	function groupRepliesByAuthor(replies: MessageType[]): MessageType[][] {
		if (replies.length === 0) return [];

		const groups: MessageType[][] = [];
		let currentGroup: MessageType[] = [];
		let currentPubkey: string | null = null;

		for (const reply of replies) {
			const pubkey = reply.event.pubkey;
			if (pubkey !== currentPubkey) {
				if (currentGroup.length > 0) {
					groups.push(currentGroup);
				}
				currentGroup = [reply];
				currentPubkey = pubkey;
			} else {
				currentGroup.push(reply);
			}
		}

		if (currentGroup.length > 0) {
			groups.push(currentGroup);
		}

		return groups;
	}
</script>

{#if messages.length > 0}
	<div class={isNested ? 'nested-replies' : ''}>
		<!-- 1. First message (establishes who's speaking) -->
		<Message
			message={firstMessage}
			isLastMessage={false}
			isConsecutive={isNested ? false : isConsecutive}
			hasNextConsecutive={true}
			{onReply}
			{onQuote}
			{onTimeClick}
		/>

		<!-- Check for nested replies to first message -->
		{#if getRepliesFor(firstMessage.id).length > 0}
			{@const firstMessageReplies = getRepliesFor(firstMessage.id)}
			{@const replyGroups = groupRepliesByAuthor(firstMessageReplies)}
			{#each replyGroups as replyGroup, idx}
				<AgentMessageBlock
					messages={replyGroup}
					{repliesByParent}
					{rootEventId}
					isNested={true}
					isLastInParent={idx === replyGroups.length - 1}
					{onReply}
					{onQuote}
					{onTimeClick}
				/>
			{/each}
		{/if}

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

					<!-- Check for nested replies to this message -->
					{#if getRepliesFor(msg.id).length > 0}
						{@const msgReplies = getRepliesFor(msg.id)}
						{@const replyGroups = groupRepliesByAuthor(msgReplies)}
						{#each replyGroups as replyGroup, idx}
							<AgentMessageBlock
								messages={replyGroup}
								{repliesByParent}
								{rootEventId}
								isNested={true}
								isLastInParent={idx === replyGroups.length - 1}
								{onReply}
								{onQuote}
								{onTimeClick}
							/>
						{/each}
					{/if}
				</div>
			{/each}
		{/if}

		<!-- 5. Last message(s) always visible (1 for nested, 2 for root level) -->
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

			<!-- Check for nested replies to this message -->
			{#if getRepliesFor(msg.id).length > 0}
				{@const msgReplies = getRepliesFor(msg.id)}
				{@const replyGroups = groupRepliesByAuthor(msgReplies)}
				{#each replyGroups as replyGroup, idx}
					<AgentMessageBlock
						messages={replyGroup}
						{repliesByParent}
						{rootEventId}
						isNested={true}
						isLastInParent={idx === replyGroups.length - 1 && isLastInGroup}
						{onReply}
						{onQuote}
						{onTimeClick}
					/>
				{/each}
			{/if}
		{/each}
	</div>
{/if}

<style>
	.nested-replies {
		background: hsl(var(--muted) / 0.3);
		border: 1px solid hsl(var(--border) / 0.5);
		border-radius: 8px;
		padding: 8px 0;
		margin: 8px 0 8px 48px;
	}
</style>
