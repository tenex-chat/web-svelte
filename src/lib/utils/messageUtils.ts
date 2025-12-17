import type { NDKEvent } from '@nostr-dev-kit/ndk';
import { NDKKind } from '$lib/kinds';

export type ThreadViewMode = 'threaded' | 'flattened';
export type ChatViewMode = 'threaded' | 'flattened' | 'delegation';

export interface Message {
	id: string;
	event: NDKEvent;
}

/**
 * Display item types for the unified display model
 */
export type DisplayItem =
	| { type: 'visible'; message: Message; isConsecutive: boolean; hasNextConsecutive: boolean; isLastReasoningMessage: boolean }
	| { type: 'collapsed'; count: number; messages: Message[] }
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
 * Group consecutive messages by author
 * Returns an array of message groups, where each group contains messages from the same author
 */
function groupMessagesByAuthor(messages: Message[]): Message[][] {
	if (messages.length === 0) return [];

	const groups: Message[][] = [];
	let currentGroup: Message[] = [messages[0]];
	let currentAuthor = messages[0].event.pubkey;

	for (let i = 1; i < messages.length; i++) {
		const msg = messages[i];
		const msgAuthor = msg.event.pubkey;

		if (msgAuthor === currentAuthor) {
			currentGroup.push(msg);
		} else {
			groups.push(currentGroup);
			currentGroup = [msg];
			currentAuthor = msgAuthor;
		}
	}

	// Push the last group
	if (currentGroup.length > 0) {
		groups.push(currentGroup);
	}

	return groups;
}

/**
 * Apply collapsing rules to a group of messages from the same author
 * Returns an array of DisplayItems (visible messages and collapsed indicators)
 */
function applyCollapsingRules(group: Message[]): DisplayItem[] {
	const items: DisplayItem[] = [];

	if (group.length === 1) {
		// Single message: always visible
		items.push({
			type: 'visible',
			message: group[0],
			isConsecutive: false,
			hasNextConsecutive: false,
			isLastReasoningMessage: false
		});
		return items;
	}

	if (group.length === 2) {
		// Two messages: both visible (no point in collapsing)
		items.push({
			type: 'visible',
			message: group[0],
			isConsecutive: false,
			hasNextConsecutive: false,
			isLastReasoningMessage: false
		});
		items.push({
			type: 'visible',
			message: group[1],
			isConsecutive: false,
			hasNextConsecutive: false,
			isLastReasoningMessage: false
		});
		return items;
	}

	// 3+ messages: apply collapsing logic
	const first = group[0];
	const last = group[group.length - 1];
	const middle = group.slice(1, -1);

	// Show first message
	items.push({
		type: 'visible',
		message: first,
		isConsecutive: false,
		hasNextConsecutive: false,
		isLastReasoningMessage: false
	});

	// Process middle messages
	const collapsedMiddle: Message[] = [];

	for (const msg of middle) {
		if (hasPTag(msg.event)) {
			// Before showing this p-tag message, flush any collapsed messages
			if (collapsedMiddle.length > 0) {
				items.push({
					type: 'collapsed',
					count: collapsedMiddle.length,
					messages: [...collapsedMiddle]
				});
				collapsedMiddle.length = 0;
			}
			// Show the p-tag message
			items.push({
				type: 'visible',
				message: msg,
				isConsecutive: false,
				hasNextConsecutive: false,
				isLastReasoningMessage: false
			});
		} else {
			collapsedMiddle.push(msg);
		}
	}

	// Flush any remaining collapsed messages
	if (collapsedMiddle.length > 0) {
		items.push({
			type: 'collapsed',
			count: collapsedMiddle.length,
			messages: [...collapsedMiddle]
		});
	}

	// Show last message
	items.push({
		type: 'visible',
		message: last,
		isConsecutive: false,
		hasNextConsecutive: false,
		isLastReasoningMessage: false
	});

	return items;
}

/**
 * Calculate consecutive states for visible messages in the display list
 */
function calculateConsecutiveStates(items: DisplayItem[]): DisplayItem[] {
	const visibleIndices: number[] = [];

	// Find all visible message indices
	for (let i = 0; i < items.length; i++) {
		if (items[i].type === 'visible') {
			visibleIndices.push(i);
		}
	}

	// Update consecutive states
	const result = [...items];
	for (let i = 0; i < visibleIndices.length; i++) {
		const idx = visibleIndices[i];
		const item = result[idx];

		if (item.type !== 'visible') continue;

		const prevIdx = i > 0 ? visibleIndices[i - 1] : -1;
		const nextIdx = i < visibleIndices.length - 1 ? visibleIndices[i + 1] : -1;

		const prevItem = prevIdx >= 0 ? result[prevIdx] : undefined;
		const nextItem = nextIdx >= 0 ? result[nextIdx] : undefined;

		const isConsecutive =
			prevItem?.type === 'visible'
				? areConsecutiveMessages(prevItem.message, item.message)
				: false;

		const hasNextConsecutive =
			nextItem?.type === 'visible'
				? areConsecutiveMessages(item.message, nextItem.message)
				: false;

		result[idx] = {
			...item,
			isConsecutive,
			hasNextConsecutive
		};
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

	// Update the last reasoning message
	const result = [...items];
	const item = result[lastReasoningIdx];
	if (item.type === 'visible') {
		result[lastReasoningIdx] = {
			...item,
			isLastReasoningMessage: true
		};
	}

	return result;
}

/**
 * Create a unified display model from messages
 * This is the main function that transforms raw messages into a display-ready list
 *
 * Returns an array where each item represents exactly what should be rendered:
 * - Visible messages with their display properties
 * - Collapsed message indicators with counts
 * - Metadata events
 */
export function createDisplayModel(
	messages: Message[],
	eventsWithMetadata?: Array<{ type: 'message' | 'metadata'; data: Message | NDKEvent }>
): DisplayItem[] {
	if (messages.length === 0) return [];

	// Step 1: Group messages by author
	const groups = groupMessagesByAuthor(messages);

	// Step 2: Apply collapsing rules to each group
	let items: DisplayItem[] = [];
	for (const group of groups) {
		items = items.concat(applyCollapsingRules(group));
	}

	// Step 3: Calculate consecutive states
	items = calculateConsecutiveStates(items);

	// Step 4: Calculate reasoning states
	items = calculateReasoningStates(items);

	// Step 5: Merge with metadata events if provided
	if (eventsWithMetadata) {
		const result: DisplayItem[] = [];
		const messageToDisplayItemMap = new Map<string, DisplayItem>();

		// Create a map of message ID to display item
		for (const item of items) {
			if (item.type === 'visible') {
				messageToDisplayItemMap.set(item.message.id, item);
			} else if (item.type === 'collapsed') {
				// Map the first message in the collapsed group to the collapsed item
				if (item.messages.length > 0) {
					messageToDisplayItemMap.set(item.messages[0].id, item);
				}
			}
		}

		// Iterate through eventsWithMetadata and build the final display list
		const processedCollapsedIds = new Set<string>();

		for (const event of eventsWithMetadata) {
			if (event.type === 'metadata') {
				result.push({ type: 'metadata', event: event.data as NDKEvent });
			} else {
				const message = event.data as Message;
				const displayItem = messageToDisplayItemMap.get(message.id);

				if (displayItem) {
					if (displayItem.type === 'collapsed') {
						// Only add collapsed items once
						if (!processedCollapsedIds.has(message.id)) {
							result.push(displayItem);
							processedCollapsedIds.add(message.id);
						}
					} else {
						result.push(displayItem);
					}
				}
			}
		}

		return result;
	}

	return items;
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
	const groups = groupMessagesByAuthor(messages);
	const result: MessageGroup[] = [];

	for (const group of groups) {
		const items = applyCollapsingRules(group);

		for (const item of items) {
			if (item.type === 'visible') {
				result.push({
					type: 'visible',
					messages: [item.message]
				});
			} else if (item.type === 'collapsed') {
				result.push({
					type: 'collapsed',
					messages: item.messages,
					collapsedCount: item.count
				});
			}
		}
	}

	return result;
}
