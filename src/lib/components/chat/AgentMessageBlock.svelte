<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import Message from './Message.svelte';
	import AgentTodoList from './AgentTodoList.svelte';
	import { type Message as MessageType, hasPTag, isCollapsible } from '$lib/utils/messageUtils';
	import { aggregateTodoState } from '$lib/utils/todoAggregator';
	import { User } from '$lib/ndk/ui/user';
	import { ChevronDown, ChevronRight } from 'lucide-svelte';
	import { slide } from 'svelte/transition';
	import { formatTimestamp } from '$lib/utils/time';

	interface Props {
		messages: MessageType[];
		isConsecutive?: boolean;
		hasNextConsecutive?: boolean;
		isLastInParent?: boolean;
		showTodoList?: boolean;
		rootEventId?: string;
		onReply?: (message: MessageType) => void;
		onQuote?: (message: MessageType) => void;
		onTimeClick?: (event: NDKEvent) => void;
		onSendAgain: (message: MessageType) => void;
	}

	let {
		messages,
		isConsecutive = false,
		hasNextConsecutive = false,
		isLastInParent = false,
		showTodoList = true,
		rootEventId,
		onReply,
		onQuote,
		onTimeClick,
		onSendAgain
	}: Props = $props();

	// Track which groups are manually expanded
	let manuallyExpanded = $state(new Set<string>());

	function toggleGroup(groupKey: string) {
		if (manuallyExpanded.has(groupKey)) {
			manuallyExpanded.delete(groupKey);
		} else {
			manuallyExpanded.add(groupKey);
		}
		manuallyExpanded = new Set(manuallyExpanded);
	}

	const groupKey = $derived(messages[0]?.id || 'unknown');
	const isManuallyExpanded = $derived(manuallyExpanded.has(groupKey));

	// Find index of first p-tagged message (if any)
	const pTagIndex = $derived.by(() => {
		for (let i = 0; i < messages.length; i++) {
			if (hasPTag(messages[i].event)) {
				return i;
			}
		}
		return -1; // No p-tag found
	});

	const hasPTagMessage = $derived(pTagIndex !== -1);

	/**
	 * Compute visibility for each message based on collapse rules:
	 *
	 * If p-tag exists:
	 *   - Before p-tag: collapse collapsible, show non-collapsible
	 *   - From p-tag onwards: show all
	 *
	 * If no p-tag (agent still working):
	 *   - Show last 2 collapsible messages
	 *   - Collapse other collapsible messages
	 *   - Always show non-collapsible (delegations)
	 */
	const messageVisibility = $derived.by(() => {
		const result: { message: MessageType; visible: boolean; collapsible: boolean }[] = [];

		if (hasPTagMessage) {
			// P-tag mode: collapse everything collapsible before p-tag
			for (let i = 0; i < messages.length; i++) {
				const msg = messages[i];
				const msgCollapsible = isCollapsible(msg);
				const isBeforePTag = i < pTagIndex;

				// Show if: non-collapsible OR at/after p-tag
				const visible = !msgCollapsible || !isBeforePTag;

				result.push({ message: msg, visible, collapsible: msgCollapsible });
			}
		} else {
			// No p-tag mode: show last 2 collapsible + all non-collapsible
			const collapsibleIndices: number[] = [];
			for (let i = 0; i < messages.length; i++) {
				if (isCollapsible(messages[i])) {
					collapsibleIndices.push(i);
				}
			}

			// Last 2 collapsible indices
			const visibleCollapsibleIndices = new Set(collapsibleIndices.slice(-2));

			for (let i = 0; i < messages.length; i++) {
				const msg = messages[i];
				const msgCollapsible = isCollapsible(msg);

				// Show if: non-collapsible OR one of last 2 collapsible
				const visible = !msgCollapsible || visibleCollapsibleIndices.has(i);

				result.push({ message: msg, visible, collapsible: msgCollapsible });
			}
		}

		return result;
	});

	// Count of collapsed messages
	const collapsedCount = $derived(
		messageVisibility.filter(m => !m.visible && m.collapsible).length
	);

	// Aggregate todo state from all messages
	const todoState = $derived(aggregateTodoState(messages.map(m => m.event)));

	// First message for header info
	const firstMessage = $derived(messages[0]);

	// Get timestamp for header
	const timestamp = $derived.by(() => {
		if (!firstMessage?.event.created_at) return '';
		return formatTimestamp(firstMessage.event.created_at);
	});

	// Get branch info for header
	const branchInfo = $derived.by(() => {
		const branchTag = firstMessage?.event.tags.find((tag) => tag[0] === 'branch');
		return branchTag ? branchTag[1] : null;
	});

	function getBranchColor(branchName: string): string {
		let hash = 0;
		for (let i = 0; i < branchName.length; i++) {
			hash = branchName.charCodeAt(i) + ((hash << 5) - hash);
		}
		const hue = Math.abs(hash % 360);
		return `hsl(${hue}, 65%, 45%)`;
	}
</script>

{#if messages.length > 0}
	<div>
		<!-- Header (always visible) -->
		{#if !isConsecutive}
			<div class="group px-4 py-1 hover:bg-muted/10 transition-colors">
				<div class="flex gap-3">
					<User.Root {ndk} pubkey={firstMessage.event.pubkey}>
						<div class="w-4 flex-shrink-0 relative">
							<User.Avatar class="w-4 h-4 rounded-md" />
							<div class="absolute left-1/2 -translate-x-1/2 top-4 bottom-0 border-l border-border/60"></div>
						</div>
					</User.Root>
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2 mb-1">
							<User.Root {ndk} pubkey={firstMessage.event.pubkey}>
								<span class="font-semibold text-sm text-foreground"><User.Name /></span>
							</User.Root>
							<button
								type="button"
								onclick={() => onTimeClick?.(firstMessage.event)}
								class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer hover:underline"
								title="Open as root conversation"
							>
								{timestamp}
							</button>
							{#if branchInfo}
								<span
									class="px-2 py-0.5 rounded-md text-[10px] font-medium text-white"
									style="background-color: {getBranchColor(branchInfo)}"
									title="Branch: {branchInfo}"
								>
									{branchInfo}
								</span>
							{/if}
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Todo list (if any) - only rendered when showTodoList is true -->
		{#if showTodoList && todoState.hasTodos}
			<div class="px-4 py-1">
				<div class="flex gap-3">
					<div class="w-4 flex-shrink-0 relative">
						<div class="absolute left-1/2 -translate-x-1/2 inset-y-0 border-l border-border/60"></div>
					</div>
					<div class="flex-1">
						<AgentTodoList items={todoState.items} />
					</div>
				</div>
			</div>
		{/if}

		<!-- Collapse indicator (if there are collapsed messages) -->
		{#if collapsedCount > 0 && !isManuallyExpanded}
			<div class="px-4 py-1">
				<div class="flex gap-3">
					<div class="w-4 flex-shrink-0 relative">
						<div class="absolute left-1/2 -translate-x-1/2 inset-y-0 border-l border-border/60"></div>
					</div>
					<button
						type="button"
						onclick={() => toggleGroup(groupKey)}
						class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
					>
						<ChevronRight class="w-3 h-3" />
						<span>{collapsedCount} message{collapsedCount !== 1 ? 's' : ''}</span>
					</button>
				</div>
			</div>
		{/if}

		<!-- All messages (rendered based on visibility) -->
		{#each messageVisibility as { message: msg, visible }, idx (msg.id)}
			{@const isLastInGroup = idx === messageVisibility.length - 1}
			{@const isRootMessage = rootEventId ? msg.id === rootEventId : false}
			{#if visible || isManuallyExpanded}
				<div transition:slide={{ duration: 150 }}>
					<Message
						message={msg}
						isLastMessage={isLastInGroup && isLastInParent}
						isConsecutive={true}
						hasNextConsecutive={!isLastInGroup || hasNextConsecutive}
						{isRootMessage}
						{onReply}
						{onQuote}
						{onTimeClick}
						{onSendAgain}
					/>
				</div>
			{/if}
		{/each}

		<!-- Collapse button when manually expanded -->
		{#if isManuallyExpanded && collapsedCount > 0}
			<div class="px-4 py-1">
				<div class="flex gap-3">
					<div class="w-4 flex-shrink-0 relative">
						<div class="absolute left-1/2 -translate-x-1/2 inset-y-0 border-l border-border/60"></div>
					</div>
					<button
						type="button"
						onclick={() => toggleGroup(groupKey)}
						class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
					>
						<ChevronDown class="w-3 h-3" />
						<span>Collapse {collapsedCount} message{collapsedCount !== 1 ? 's' : ''}</span>
					</button>
				</div>
			</div>
		{/if}
	</div>
{/if}
