import type { NDKEvent } from '@nostr-dev-kit/ndk';

export type ProcessedMetadataResult =
	| { success: true; conversationId: string; title?: MetadataField; summary?: MetadataField }
	| { success: false; error: string; eventId?: string };

export interface MetadataField {
	value: string;
	timestamp: number;
}

/**
 * Extracts the conversation ID from an event.
 * If the event has an "e" tag (lowercase), it's a reply and returns the referenced event ID.
 * If no "e" tag, this is a root event and returns its own ID.
 */
export function extractConversationId(event: NDKEvent | undefined): string | undefined {
	if (!event) return undefined;

	if (event.tags) {
		// Look for lowercase "e" tag - root events have no "e" tags
		const eTag = event.tags.find((tag) => tag[0] === 'e');
		if (eTag) {
			return eTag[1];
		}
	}

	// No "e" tag means this is a root event - use its own ID
	return event.id;
}

/**
 * Processes a kind 513 event to extract conversation metadata.
 * Implements cumulative updates with timestamp comparison.
 */
export function processConversationMetadataEvent(
	event: NDKEvent,
	currentMetadata?: { title?: MetadataField; summary?: MetadataField }
): ProcessedMetadataResult {
	// Find the "e" tag to get the conversation ID
	const eTag = event.tags?.find((tag) => tag[0] === 'e');
	const conversationId = eTag ? eTag[1] : undefined;

	if (!conversationId) {
		return {
			success: false,
			error: 'Missing required conversation ID (e tag)',
			eventId: event.id
		};
	}

	const eventTimestamp = event.created_at;

	if (!eventTimestamp && eventTimestamp !== 0) {
		return {
			success: false,
			error: 'Missing created_at timestamp',
			eventId: event.id
		};
	}

	let titleToUpdate: MetadataField | undefined;
	let summaryToUpdate: MetadataField | undefined;

	// Extract title from 'title' tag if present
	const titleTag = event.tags.find((tag) => tag[0] === 'title');
	if (titleTag && typeof titleTag[1] === 'string') {
		if (!currentMetadata?.title || eventTimestamp > currentMetadata.title.timestamp) {
			titleToUpdate = { value: titleTag[1], timestamp: eventTimestamp };
		}
	}

	// Extract summary from 'summary' tag if present
	const summaryTag = event.tags.find((tag) => tag[0] === 'summary');
	if (summaryTag && typeof summaryTag[1] === 'string') {
		if (!currentMetadata?.summary || eventTimestamp > currentMetadata.summary.timestamp) {
			summaryToUpdate = { value: summaryTag[1], timestamp: eventTimestamp };
		}
	}

	if (titleToUpdate || summaryToUpdate) {
		return {
			success: true,
			conversationId,
			title: titleToUpdate,
			summary: summaryToUpdate
		};
	}

	return {
		success: true,
		conversationId,
		title: undefined,
		summary: undefined
	};
}
