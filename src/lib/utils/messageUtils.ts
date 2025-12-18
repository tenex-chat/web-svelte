import type { NDKEvent } from '@nostr-dev-kit/ndk';
import { NDKKind } from '$lib/kinds';

export type ThreadViewMode = 'threaded' | 'flattened';
export type ChatViewMode = 'threaded' | 'flattened' | 'delegation';

export interface Message {
	id: string;
	event: NDKEvent;
}

/**
 * Intermediate representation after tool grouping
 * Sequential tool calls and adjacent thinking blocks are combined into a single tool_group
 */
export type GroupedItem =
	| { type: 'message'; message: Message }
	| { type: 'tool_group'; tools: Message[]; thinking: Message[] };

/**
 * Display item types for the unified display model
 */
export type DisplayItem =
	| { type: 'visible'; message: Message; isConsecutive: boolean; hasNextConsecutive: boolean; isLastReasoningMessage: boolean }
	| { type: 'collapsed'; count: number; items: GroupedItem[] }
	| { type: 'tool_group'; tools: Message[]; thinking: Message[]; isConsecutive: boolean; hasNextConsecutive: boolean; isActive: boolean }
	| { type: 'metadata'; event: NDKEvent };

/**
 * Check if an event has p-tags (mentions)
 */
export function hasPTag(event: NDKEvent): boolean {
	return event.tags?.some((tag) => tag[0] === 'p') ?? false;
}

/**
 * Check if a message is a metadata event
 */
export function isMetadataEvent(message: Message): boolean {
	return message.event.kind === NDKKind.TenexConversationMetadata;
}

/**
 * Check if a message has a reasoning tag
 */
export function hasReasoningTag(message: Message): boolean {
	return message.event.tags?.some((tag) => tag[0] === 'reasoning') ?? false;
}

/**
 * Check if a message is a tool call event
 */
export function isToolCall(message: Message): boolean {
	return message.event.hasTag('tool');
}

/**
 * Check if two messages are from the same author and should be displayed consecutively
 */
export function areConsecutiveMessages(prev: Message | undefined, current: Message | undefined): boolean {
	if (!prev || !current) return false;

	return (
		prev.event.pubkey === current.event.pubkey &&
		!isMetadataEvent(prev) &&
		!isMetadataEvent(current) &&
		!hasPTag(current.event) &&
		!hasPTag(prev.event)
	);
}

/**
 * Find the index of the last message with a reasoning tag
 */
export function findLastReasoningIndex(messages: Message[]): number {
	for (let i = messages.length - 1; i >= 0; i--) {
		if (hasReasoningTag(messages[i])) {
			return i;
		}
	}
	return -1;
}

/**
 * Get the author pubkey of a GroupedItem
 */
function getItemAuthor(item: GroupedItem): string {
	if (item.type === 'message') {
		return item.message.event.pubkey;
	}
	// For tool_group, prefer tools but fall back to thinking
	if (item.tools.length > 0) {
		return item.tools[0].event.pubkey;
	}
	if (item.thinking.length > 0) {
		return item.thinking[0].event.pubkey;
	}
	return '';
}

/**
 * Check if a GroupedItem has p-tags (only messages can have p-tags)
 */
function itemHasPTag(item: GroupedItem): boolean {
	return item.type === 'message' && hasPTag(item.message.event);
}

/**
 * Classify a message as tool, thinking, or regular message
 */
function classifyMessage(message: Message): 'tool' | 'thinking' | 'message' {
	if (isToolCall(message)) return 'tool';
	if (hasReasoningTag(message)) return 'thinking';
	return 'message';
}

/**
 * Group sequential tool calls and adjacent thinking blocks together
 *
 * Rules:
 * - A group is a maximal sequence of (tool | thinking) with no text messages in between
 * - If the group has tools, it becomes a tool_group (with thinking absorbed)
 * - If the group has only thinking (no tools), the thinking messages stay as individual messages
 */
function groupSequentialToolCalls(messages: Message[]): GroupedItem[] {
	if (messages.length === 0) return [];

	const result: GroupedItem[] = [];
	let pendingTools: Message[] = [];
	let pendingThinking: Message[] = [];

	function flushPending() {
		if (pendingTools.length > 0) {
			// We have tools - create a tool_group with any adjacent thinking
			result.push({
				type: 'tool_group',
				tools: [...pendingTools],
				thinking: [...pendingThinking]
			});
		} else if (pendingThinking.length > 0) {
			// Only thinking, no tools - emit as individual messages
			for (const t of pendingThinking) {
				result.push({ type: 'message', message: t });
			}
		}
		pendingTools = [];
		pendingThinking = [];
	}

	for (const msg of messages) {
		const msgType = classifyMessage(msg);

		if (msgType === 'tool') {
			pendingTools.push(msg);
		} else if (msgType === 'thinking') {
			pendingThinking.push(msg);
		} else {
			// Regular message - flush any pending group and emit the message
			flushPending();
			result.push({ type: 'message', message: msg });
		}
	}

	flushPending();
	return result;
}

/**
 * Group items by author
 * Returns an array of item groups, where each group contains items from the same author
 */
function groupItemsByAuthor(items: GroupedItem[]): GroupedItem[][] {
	if (items.length === 0) return [];

	const groups: GroupedItem[][] = [];
	let currentGroup: GroupedItem[] = [items[0]];
	let currentAuthor = getItemAuthor(items[0]);

	for (let i = 1; i < items.length; i++) {
		const item = items[i];
		const itemAuthor = getItemAuthor(item);

		if (itemAuthor === currentAuthor) {
			currentGroup.push(item);
		} else {
			groups.push(currentGroup);
			currentGroup = [item];
			currentAuthor = itemAuthor;
		}
	}

	if (currentGroup.length > 0) {
		groups.push(currentGroup);
	}

	return groups;
}

/**
 * Convert a GroupedItem to a DisplayItem
 * Tool groups get isActive=false by default (will be updated later)
 */
function itemToDisplayItem(item: GroupedItem): DisplayItem {
	if (item.type === 'tool_group') {
		return {
			type: 'tool_group',
			tools: item.tools,
			thinking: item.thinking,
			isConsecutive: false,
			hasNextConsecutive: false,
			isActive: false
		};
	} else {
		return {
			type: 'visible',
			message: item.message,
			isConsecutive: false,
			hasNextConsecutive: false,
			isLastReasoningMessage: false
		};
	}
}

/**
 * Apply collapsing rules to a group of items from the same author
 * Regular messages collapse at 4+, tool groups are always shown (they handle their own collapsing)
 */
function applyCollapsingRules(group: GroupedItem[]): DisplayItem[] {
	const items: DisplayItem[] = [];
	const COLLAPSE_THRESHOLD = 4;

	// Small groups: show everything
	if (group.length < COLLAPSE_THRESHOLD) {
		for (const item of group) {
			items.push(itemToDisplayItem(item));
		}
		return items;
	}

	// Large groups: apply collapsing logic (show first, collapse middle, show last)
	const first = group[0];
	const last = group[group.length - 1];
	const middle = group.slice(1, -1);

	// Show first item
	items.push(itemToDisplayItem(first));

	// Helper to flush pending items
	function flushPending(pending: GroupedItem[], target: DisplayItem[]) {
		if (pending.length === 0) return;

		if (pending.length >= COLLAPSE_THRESHOLD) {
			target.push({
				type: 'collapsed',
				count: pending.length,
				items: [...pending]
			});
		} else {
			for (const p of pending) {
				target.push(itemToDisplayItem(p));
			}
		}
	}

	// Process middle items
	const pendingItems: GroupedItem[] = [];

	for (const item of middle) {
		if (itemHasPTag(item)) {
			// p-tag items break the collapse - flush pending and show the p-tag item
			flushPending(pendingItems, items);
			pendingItems.length = 0;
			items.push(itemToDisplayItem(item));
		} else {
			pendingItems.push(item);
		}
	}

	// Flush remaining pending items
	flushPending(pendingItems, items);

	// Show last item
	items.push(itemToDisplayItem(last));

	return items;
}

/**
 * Calculate consecutive states for display items
 */
function calculateConsecutiveStates(items: DisplayItem[]): DisplayItem[] {
	// Get indices of items that need consecutive tracking (visible messages and tool_groups)
	const trackableIndices: number[] = [];
	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		if (item.type === 'visible' || item.type === 'tool_group') {
			trackableIndices.push(i);
		}
	}

	const result = [...items];

	for (let i = 0; i < trackableIndices.length; i++) {
		const idx = trackableIndices[i];
		const item = result[idx];

		// Get previous and next trackable items
		const prevIdx = i > 0 ? trackableIndices[i - 1] : -1;
		const nextIdx = i < trackableIndices.length - 1 ? trackableIndices[i + 1] : -1;
		const prevItem = prevIdx >= 0 ? result[prevIdx] : undefined;
		const nextItem = nextIdx >= 0 ? result[nextIdx] : undefined;

		// Helper to get pubkey from item
		const getPubkey = (it: DisplayItem): string | undefined => {
			if (it.type === 'visible') return it.message.event.pubkey;
			if (it.type === 'tool_group') return it.tools[0]?.event.pubkey;
			return undefined;
		};

		const currentPubkey = getPubkey(item);
		const prevPubkey = prevItem ? getPubkey(prevItem) : undefined;
		const nextPubkey = nextItem ? getPubkey(nextItem) : undefined;

		const isConsecutive = prevPubkey === currentPubkey;
		const hasNextConsecutive = nextPubkey === currentPubkey;

		if (item.type === 'visible') {
			result[idx] = { ...item, isConsecutive, hasNextConsecutive };
		} else if (item.type === 'tool_group') {
			result[idx] = { ...item, isConsecutive, hasNextConsecutive };
		}
	}

	return result;
}

/**
 * Calculate reasoning states for visible messages in the display list
 */
function calculateReasoningStates(items: DisplayItem[]): DisplayItem[] {
	// Find the last visible message with a reasoning tag
	let lastReasoningIdx = -1;
	for (let i = items.length - 1; i >= 0; i--) {
		const item = items[i];
		if (item.type === 'visible' && hasReasoningTag(item.message)) {
			lastReasoningIdx = i;
			break;
		}
	}

	if (lastReasoningIdx === -1) return items;

	const result = [...items];
	const item = result[lastReasoningIdx];
	if (item.type === 'visible') {
		result[lastReasoningIdx] = { ...item, isLastReasoningMessage: true };
	}

	return result;
}

/**
 * Mark the last tool_group as active (currently running)
 * Only if there are no visible messages after it
 */
function markActiveToolGroup(items: DisplayItem[]): DisplayItem[] {
	// Find the last tool_group
	let lastToolGroupIdx = -1;
	for (let i = items.length - 1; i >= 0; i--) {
		if (items[i].type === 'tool_group') {
			lastToolGroupIdx = i;
			break;
		}
	}

	if (lastToolGroupIdx === -1) return items;

	// Check if there are any visible messages after the last tool group
	const hasVisibleAfter = items.slice(lastToolGroupIdx + 1).some(
		(item) => item.type === 'visible' || item.type === 'collapsed'
	);

	// Only mark as active if nothing visible comes after
	if (hasVisibleAfter) return items;

	const result = [...items];
	const item = result[lastToolGroupIdx];
	if (item.type === 'tool_group') {
		result[lastToolGroupIdx] = { ...item, isActive: true };
	}

	return result;
}

/**
 * Create a unified display model from messages
 * This is the main function that transforms raw messages into a display-ready list
 *
 * Flow:
 * 1. Group sequential tool calls into tool_group items
 * 2. Group items by author
 * 3. Apply collapsing rules to each author group
 * 4. Calculate consecutive states
 * 5. Calculate reasoning states
 * 6. Mark active tool group
 * 7. Merge with metadata events if provided
 */
export function createDisplayModel(
	messages: Message[],
	eventsWithMetadata?: Array<{ type: 'message' | 'metadata'; data: Message | NDKEvent }>
): DisplayItem[] {
	if (messages.length === 0) return [];

	// Step 1: Group sequential tool calls
	const groupedItems = groupSequentialToolCalls(messages);

	// Step 2: Group items by author
	const authorGroups = groupItemsByAuthor(groupedItems);

	// Step 3: Apply collapsing rules to each group
	let items: DisplayItem[] = [];
	for (const group of authorGroups) {
		items = items.concat(applyCollapsingRules(group));
	}

	// Step 4: Calculate consecutive states
	items = calculateConsecutiveStates(items);

	// Step 5: Calculate reasoning states
	items = calculateReasoningStates(items);

	// Step 6: Mark active tool group
	items = markActiveToolGroup(items);

	// Step 7: Merge with metadata events if provided
	if (eventsWithMetadata) {
		const result: DisplayItem[] = [];

		// Build a map from message ID to its display item
		// For tool_groups, map all tool message IDs to the same tool_group item
		// For collapsed items, map the first message ID to the collapsed item
		const messageToDisplayItemMap = new Map<string, DisplayItem>();
		const processedItemIds = new Set<string>();

		for (const item of items) {
			if (item.type === 'visible') {
				messageToDisplayItemMap.set(item.message.id, item);
			} else if (item.type === 'tool_group') {
				// Map all tool IDs to this tool_group
				for (const tool of item.tools) {
					messageToDisplayItemMap.set(tool.id, item);
				}
			} else if (item.type === 'collapsed') {
				// Map first message/tool ID of each grouped item
				for (const groupedItem of item.items) {
					if (groupedItem.type === 'message') {
						messageToDisplayItemMap.set(groupedItem.message.id, item);
						break; // Only need one mapping for the collapsed group
					} else if (groupedItem.type === 'tool_group') {
						if (groupedItem.tools.length > 0) {
							messageToDisplayItemMap.set(groupedItem.tools[0].id, item);
							break;
						}
					}
				}
			}
		}

		// Iterate through eventsWithMetadata and build the final display list
		for (const event of eventsWithMetadata) {
			if (event.type === 'metadata') {
				result.push({ type: 'metadata', event: event.data as NDKEvent });
			} else {
				const message = event.data as Message;
				const displayItem = messageToDisplayItemMap.get(message.id);

				if (displayItem) {
					// Generate a unique ID for the display item to avoid duplicates
					const itemId = getDisplayItemId(displayItem);

					if (!processedItemIds.has(itemId)) {
						result.push(displayItem);
						processedItemIds.add(itemId);
					}
				}
			}
		}

		return result;
	}

	return items;
}

/**
 * Generate a unique ID for a DisplayItem
 */
function getDisplayItemId(item: DisplayItem): string {
	if (item.type === 'visible') {
		return `visible-${item.message.id}`;
	} else if (item.type === 'tool_group') {
		return `tool_group-${item.tools.map((t) => t.id).join('-')}`;
	} else if (item.type === 'collapsed') {
		const firstItemId = item.items[0]
			? item.items[0].type === 'message'
				? item.items[0].message.id
				: item.items[0].tools[0]?.id
			: 'empty';
		return `collapsed-${firstItemId}`;
	} else {
		return `metadata-${item.event.id}`;
	}
}

/**
 * Get unique author pubkeys from a list of messages
 * Used for displaying author avatars in reply collapse buttons
 */
export function getUniquePubkeys(messages: Message[]): string[] {
	const uniquePubkeys = new Set<string>();
	for (const msg of messages) {
		uniquePubkeys.add(msg.event.pubkey);
	}
	return Array.from(uniquePubkeys);
}

/**
 * @deprecated Use createDisplayModel instead
 */
export function calculateMessageProperties(messages: Message[]) {
	const lastReasoningIndex = findLastReasoningIndex(messages);

	return messages.map((msg, index) => {
		const nextMsg = messages[index + 1];
		return {
			message: msg,
			isConsecutive: areConsecutiveMessages(messages[index - 1], msg),
			hasNextConsecutive: nextMsg ? areConsecutiveMessages(msg, nextMsg) : false,
			isLastReasoningMessage: index === lastReasoningIndex
		};
	});
}

/**
 * @deprecated Use createDisplayModel instead
 */
export interface MessageGroup {
	type: 'visible' | 'collapsed';
	messages: Message[];
	collapsedCount?: number;
}

/**
 * @deprecated Use createDisplayModel instead
 */
export function calculateCollapsedMessageGroups(messages: Message[]): MessageGroup[] {
	const groupedItems = groupSequentialToolCalls(messages);
	const authorGroups = groupItemsByAuthor(groupedItems);
	const result: MessageGroup[] = [];

	for (const group of authorGroups) {
		const items = applyCollapsingRules(group);

		for (const item of items) {
			if (item.type === 'visible') {
				result.push({
					type: 'visible',
					messages: [item.message]
				});
			} else if (item.type === 'tool_group') {
				result.push({
					type: 'visible',
					messages: item.tools
				});
			} else if (item.type === 'collapsed') {
				// Flatten GroupedItems to messages
				const flatMessages: Message[] = [];
				for (const gi of item.items) {
					if (gi.type === 'message') {
						flatMessages.push(gi.message);
					} else {
						flatMessages.push(...gi.tools);
					}
				}
				result.push({
					type: 'collapsed',
					messages: flatMessages,
					collapsedCount: item.count
				});
			}
		}
	}

	return result;
}
