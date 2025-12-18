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
function groupSequentialToolCalls(messages: Message[]): DisplayItem[] {
	if (messages.length === 0) return [];

	const result: DisplayItem[] = [];
	let pendingTools: Message[] = [];
	let pendingThinking: Message[] = [];

	function flushPending() {
		if (pendingTools.length > 0) {
			// We have tools - create a tool_group with any adjacent thinking
			result.push({
				type: 'tool_group',
				tools: [...pendingTools],
				thinking: [...pendingThinking],
				isConsecutive: false,
				hasNextConsecutive: false,
				isActive: false
			});
		} else if (pendingThinking.length > 0) {
			// Only thinking, no tools - emit as individual messages
			for (const t of pendingThinking) {
				result.push({
					type: 'visible',
					message: t,
					isConsecutive: false,
					hasNextConsecutive: false,
					isLastReasoningMessage: false
				});
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
			result.push({
				type: 'visible',
				message: msg,
				isConsecutive: false,
				hasNextConsecutive: false,
				isLastReasoningMessage: false
			});
		}
	}

	flushPending();
	return result;
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
		(item) => item.type === 'visible'
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
 *
 * Flow:
 * 1. Group sequential tool calls into tool_group items
 * 2. Calculate consecutive states
 * 3. Calculate reasoning states
 * 4. Mark active tool group
 * 5. Merge with metadata events if provided
 */
export function createDisplayModel(
	messages: Message[],
	eventsWithMetadata?: Array<{ type: 'message' | 'metadata'; data: Message | NDKEvent }>
): DisplayItem[] {
	if (messages.length === 0) return [];

	// Step 1: Group sequential tool calls
	let items = groupSequentialToolCalls(messages);

	// Step 2: Calculate consecutive states
	items = calculateConsecutiveStates(items);

	// Step 3: Calculate reasoning states
	items = calculateReasoningStates(items);

	// Step 4: Mark active tool group
	items = markActiveToolGroup(items);

	// Step 5: Merge with metadata events if provided
	if (eventsWithMetadata) {
		const result: DisplayItem[] = [];

		// Build a map from message ID to its display item
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
