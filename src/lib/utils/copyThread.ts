import type { NDKEvent } from '@nostr-dev-kit/ndk';
import type { Message } from '$lib/utils/messageUtils';

/**
 * Formats a thread as JSONL (JSON Lines) with all events in chronological order
 * Each line is a complete JSON object representing one event
 */
export async function formatThreadAsJSONL(
	messages: Message[],
	rootEvent: NDKEvent | null,
	allThreadEvents: NDKEvent[] = []
): Promise<string> {
	if (!messages || messages.length === 0) {
		return '';
	}

	// Collect all events
	const allEvents = [...messages.map((m) => m.event), ...allThreadEvents];

	// Add root event if it exists and isn't already included
	if (rootEvent && !allEvents.find((e) => e.id === rootEvent.id)) {
		allEvents.unshift(rootEvent);
	}

	// Remove duplicates based on event ID
	const uniqueEvents = Array.from(new Map(allEvents.map((e) => [e.id, e])).values());

	// Sort by timestamp (oldest first)
	const sortedEvents = uniqueEvents
		.filter((event) => event.created_at !== undefined)
		.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));

	// Convert each event to JSONL format using rawEvent()
	const lines = sortedEvents.map((event) => {
		return JSON.stringify(event.rawEvent());
	});

	return lines.join('\n');
}
