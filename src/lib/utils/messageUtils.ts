import type { NDKEvent } from '@nostr-dev-kit/ndk';
import { NDKKind } from '$lib/kinds';

export type ThreadViewMode = 'threaded' | 'flattened';

export interface Message {
	id: string;
	event: NDKEvent;
}

/**
 * Check if two messages should be displayed as consecutive (from same author, no interruptions)
 * Consecutive messages show reduced spacing and no repeated avatar
 */
export function isConsecutiveMessage(
	previousMessage: Message | undefined,
	currentMessage: Message
): boolean {
	if (!previousMessage) return false;

	const hasPTag = (event: NDKEvent) => event.tags?.some((tag) => tag[0] === 'p');

	return (
		previousMessage.event.pubkey === currentMessage.event.pubkey &&
		previousMessage.event.kind !== NDKKind.TenexConversationMetadata &&
		currentMessage.event.kind !== NDKKind.TenexConversationMetadata &&
		!hasPTag(currentMessage.event) &&
		!hasPTag(previousMessage.event)
	);
}

/**
 * Check if the next message will be consecutive to this one
 */
export function hasNextConsecutiveMessage(
	currentMessage: Message,
	nextMessage: Message | undefined
): boolean {
	if (!nextMessage) return false;

	const hasPTag = (event: NDKEvent) => event.tags?.some((tag) => tag[0] === 'p');

	return (
		nextMessage.event.pubkey === currentMessage.event.pubkey &&
		nextMessage.event.kind !== NDKKind.TenexConversationMetadata &&
		currentMessage.event.kind !== NDKKind.TenexConversationMetadata &&
		!hasPTag(nextMessage.event) &&
		!hasPTag(currentMessage.event)
	);
}

/**
 * Find the index of the last message with a reasoning tag
 */
export function findLastReasoningIndex(messages: Message[]): number {
	for (let i = messages.length - 1; i >= 0; i--) {
		if (messages[i].event.tags?.some((tag) => tag[0] === 'reasoning')) {
			return i;
		}
	}
	return -1;
}

// Cache for memoized message properties
const messagePropertiesCache = new WeakMap<Message[], any[]>();
let lastMessagesCacheKey: Message[] | null = null;
let lastMessagesHash: string | null = null;

/**
 * Generate a simple hash for message array comparison
 */
function generateMessagesHash(messages: Message[]): string {
	return messages.map(m => `${m.id}:${m.event.created_at}`).join(',');
}

/**
 * Calculate message display properties for a list of messages
 * Pre-computes consecutive states and reasoning flags
 * OPTIMIZED: Uses memoization to avoid recalculating unchanged messages
 */
export function calculateMessageProperties(messages: Message[]) {
	// Fast path: If same array reference and no changes, return cached
	if (messages === lastMessagesCacheKey && messagePropertiesCache.has(messages)) {
		return messagePropertiesCache.get(messages)!;
	}

	// Check if content is the same despite different array reference
	const currentHash = generateMessagesHash(messages);
	if (currentHash === lastMessagesHash && lastMessagesCacheKey && messagePropertiesCache.has(lastMessagesCacheKey)) {
		// Same content, just update the cache with new array reference
		const cachedResult = messagePropertiesCache.get(lastMessagesCacheKey)!;
		messagePropertiesCache.set(messages, cachedResult);
		lastMessagesCacheKey = messages;
		return cachedResult;
	}

	// Need to recalculate
	const lastReasoningIndex = findLastReasoningIndex(messages);

	const result = messages.map((msg, index) => ({
		message: msg,
		isConsecutive: isConsecutiveMessage(messages[index - 1], msg),
		hasNextConsecutive: hasNextConsecutiveMessage(msg, messages[index + 1]),
		isLastReasoningMessage: index === lastReasoningIndex
	}));

	// Cache the result
	messagePropertiesCache.set(messages, result);
	lastMessagesCacheKey = messages;
	lastMessagesHash = currentHash;

	return result;
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
