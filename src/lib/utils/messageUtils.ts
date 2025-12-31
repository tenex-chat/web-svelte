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
	| { type: 'agent_group'; messages: Message[]; isConsecutive: boolean; hasNextConsecutive: boolean }
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
 * Check if a message is a delegation tool call (should never be collapsed)
 */
export function isDelegationToolCall(message: Message): boolean {
	const toolName = message.event.tagValue('tool');
	return toolName === 'delegate' || toolName === 'delegate_external';
}

/**
 * Check if a message is collapsible.
 * Non-collapsible: delegations (always visible regardless of position)
 * Collapsible: everything else (regular messages, tool calls, reasoning events)
 */
export function isCollapsible(message: Message): boolean {
	// Delegations are never collapsible
	if (isDelegationToolCall(message)) return false;

	// Everything else is collapsible
	return true;
}

/**
 * Get unique author pubkeys from a list of messages
 */
export function getUniquePubkeys(messages: Message[]): string[] {
	const uniquePubkeys = new Set<string>();
	for (const msg of messages) {
		uniquePubkeys.add(msg.event.pubkey);
	}
	return Array.from(uniquePubkeys);
}

/**
 * Group consecutive messages from the same agent into agent_group items.
 *
 * Rules:
 * - Messages from the same pubkey are grouped together
 * - A p-tag in a message breaks the group (that message starts a new group or is standalone)
 * - Metadata events are passed through as-is
 */
function groupConsecutiveAgentMessages(messages: Message[]): DisplayItem[] {
	if (messages.length === 0) return [];

	const result: DisplayItem[] = [];
	let currentGroup: Message[] = [];
	let currentPubkey: string | null = null;

	function flushGroup() {
		if (currentGroup.length === 0) return;

		if (currentGroup.length === 1) {
			// Single message - emit as visible
			result.push({
				type: 'visible',
				message: currentGroup[0],
				isConsecutive: false,
				hasNextConsecutive: false,
				isLastReasoningMessage: false
			});
		} else {
			// Multiple messages - emit as agent_group
			result.push({
				type: 'agent_group',
				messages: [...currentGroup],
				isConsecutive: false,
				hasNextConsecutive: false
			});
		}
		currentGroup = [];
		currentPubkey = null;
	}

	for (const msg of messages) {
		const msgPubkey = msg.event.pubkey;
		const msgHasPTag = hasPTag(msg.event);
		const msgIsDelegation = isDelegationToolCall(msg);

		// Check if this message should break the current group
		const shouldBreak =
			msgPubkey !== currentPubkey || // Different author
			msgHasPTag || // Message mentions someone (p-tag)
			msgIsDelegation || // Delegation tool call (should never be collapsed)
			isMetadataEvent(msg); // Metadata event

		if (shouldBreak) {
			flushGroup();
		}

		if (isMetadataEvent(msg)) {
			// Metadata events are standalone
			result.push({ type: 'metadata', event: msg.event });
		} else {
			// Add to current group
			currentGroup.push(msg);
			currentPubkey = msgPubkey;
		}
	}

	flushGroup();
	return result;
}

/**
 * Calculate consecutive states for agent groups and visible messages
 */
function calculateConsecutiveStates(items: DisplayItem[]): DisplayItem[] {
	const result = [...items];

	// Get pubkey from a display item
	const getPubkey = (item: DisplayItem): string | undefined => {
		if (item.type === 'visible') return item.message.event.pubkey;
		if (item.type === 'agent_group') return item.messages[0]?.event.pubkey;
		return undefined;
	};

	for (let i = 0; i < result.length; i++) {
		const item = result[i];
		if (item.type === 'metadata') continue;

		const prevItem = i > 0 ? result[i - 1] : undefined;
		const nextItem = i < result.length - 1 ? result[i + 1] : undefined;

		const currentPubkey = getPubkey(item);
		const prevPubkey = prevItem ? getPubkey(prevItem) : undefined;
		const nextPubkey = nextItem ? getPubkey(nextItem) : undefined;

		const isConsecutive = prevPubkey === currentPubkey;
		const hasNextConsecutive = nextPubkey === currentPubkey;

		if (item.type === 'visible') {
			result[i] = { ...item, isConsecutive, hasNextConsecutive };
		} else if (item.type === 'agent_group') {
			result[i] = { ...item, isConsecutive, hasNextConsecutive };
		}
	}

	return result;
}

/**
 * Generate unique ID for display items
 */
function getDisplayItemId(item: DisplayItem): string {
	if (item.type === 'visible') {
		return `visible-${item.message.id}`;
	} else if (item.type === 'agent_group') {
		return `agent_group-${item.messages.map((m) => m.id).join('-')}`;
	} else if (item.type === 'metadata') {
		return `metadata-${item.event.id}`;
	}
	return `unknown-${Date.now()}`;
}

/**
 * Create a simplified display model that groups consecutive agent messages.
 *
 * This is the main function for creating the display model in flattened view.
 * It groups all consecutive messages from the same agent together,
 * breaking only on p-tags (mentions) or metadata events.
 */
export function createSimplifiedDisplayModel(
	messages: Message[],
	eventsWithMetadata?: Array<{ type: 'message' | 'metadata'; data: Message | NDKEvent }>
): DisplayItem[] {
	if (messages.length === 0) return [];

	// Step 1: Group consecutive messages from same agent
	let items = groupConsecutiveAgentMessages(messages);

	// Step 2: Calculate consecutive states
	items = calculateConsecutiveStates(items);

	// Step 3: Handle metadata events if provided
	if (eventsWithMetadata) {
		const result: DisplayItem[] = [];
		const messageToItemMap = new Map<string, DisplayItem>();
		const processedItemIds = new Set<string>();

		// Build map from message ID to display item
		for (const item of items) {
			if (item.type === 'visible') {
				messageToItemMap.set(item.message.id, item);
			} else if (item.type === 'agent_group') {
				for (const msg of item.messages) {
					messageToItemMap.set(msg.id, item);
				}
			}
		}

		// Process in order of eventsWithMetadata
		for (const event of eventsWithMetadata) {
			if (event.type === 'metadata') {
				result.push({ type: 'metadata', event: event.data as NDKEvent });
			} else {
				const message = event.data as Message;
				const displayItem = messageToItemMap.get(message.id);

				if (displayItem) {
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
