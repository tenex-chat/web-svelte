import type { NDKEvent } from '@nostr-dev-kit/ndk';
import { EVENT_KINDS } from '$lib/constants';

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
		previousMessage.event.kind !== EVENT_KINDS.CONVERSATION_METADATA &&
		currentMessage.event.kind !== EVENT_KINDS.CONVERSATION_METADATA &&
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
		nextMessage.event.kind !== EVENT_KINDS.CONVERSATION_METADATA &&
		currentMessage.event.kind !== EVENT_KINDS.CONVERSATION_METADATA &&
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

/**
 * Calculate message display properties for a list of messages
 * Pre-computes consecutive states and reasoning flags
 */
export function calculateMessageProperties(messages: Message[]) {
	const lastReasoningIndex = findLastReasoningIndex(messages);

	return messages.map((msg, index) => ({
		message: msg,
		isConsecutive: isConsecutiveMessage(messages[index - 1], msg),
		hasNextConsecutive: hasNextConsecutiveMessage(msg, messages[index + 1]),
		isLastReasoningMessage: index === lastReasoningIndex
	}));
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
