import type { NDKEvent } from '@nostr-dev-kit/ndk';
import type { Message } from './messageProcessor';

export interface ThreadedMessage extends Message {
	replies: ThreadedMessage[];
	depth: number;
	parentId?: string;
}

/**
 * Builds a hierarchical tree structure from flat messages
 */
export function buildMessageTree(messages: Message[], rootEvent: NDKEvent | null): ThreadedMessage[] {
	// Create a map for quick lookup
	const messageMap = new Map<string, ThreadedMessage>();

	// Convert all messages to ThreadedMessage format
	messages.forEach(message => {
		messageMap.set(message.id, {
			...message,
			replies: [],
			depth: 0,
			parentId: undefined
		});
	});

	// Build parent-child relationships
	messages.forEach(message => {
		const threadedMsg = messageMap.get(message.id);
		if (!threadedMsg) return;

		// Find parent via e-tag (lowercase = parent reference)
		const eTags = message.event.getMatchingTags('e');
		const parentTag = eTags.find(tag => tag[3] === 'reply' || (!tag[3] && tag[1] !== rootEvent?.id));

		if (parentTag) {
			const parentId = parentTag[1];
			const parent = messageMap.get(parentId);

			if (parent) {
				threadedMsg.parentId = parentId;
				threadedMsg.depth = parent.depth + 1;
				parent.replies.push(threadedMsg);
			}
		}
	});

	// Return only root-level messages (those without parents or root itself)
	const rootMessages: ThreadedMessage[] = [];
	messageMap.forEach(message => {
		if (!message.parentId || message.event.id === rootEvent?.id) {
			rootMessages.push(message);
		}
	});

	// Sort replies recursively by timestamp
	function sortReplies(message: ThreadedMessage) {
		message.replies.sort((a, b) => {
			const timeA = a.event.created_at ?? 0;
			const timeB = b.event.created_at ?? 0;
			return timeA - timeB;
		});
		message.replies.forEach(sortReplies);
	}

	rootMessages.forEach(sortReplies);

	return rootMessages.sort((a, b) => {
		const timeA = a.event.created_at ?? 0;
		const timeB = b.event.created_at ?? 0;
		return timeA - timeB;
	});
}

/**
 * Flattens a message tree back to a flat array (for flattened view)
 */
export function flattenMessageTree(tree: ThreadedMessage[]): ThreadedMessage[] {
	const flattened: ThreadedMessage[] = [];

	function traverse(message: ThreadedMessage) {
		flattened.push(message);
		message.replies.forEach(traverse);
	}

	tree.forEach(traverse);
	return flattened;
}
