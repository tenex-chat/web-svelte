import type NDK from '@nostr-dev-kit/ndk';
import type { NDKEvent } from '@nostr-dev-kit/ndk';
import type { Message } from '$lib/utils/messageUtils';

interface JSONMessage {
	id: string;
	author: string;
	timestamp: string;
	content: string;
	tags: {
		tool?: string[];
		p?: string[];
	};
}

/**
 * Fetch profile name for a pubkey
 */
async function getProfileName(ndk: NDK | undefined, pubkey: string): Promise<string> {
	if (!ndk) return `User ${pubkey.slice(0, 8)}...`;

	try {
		const user = ndk.getUser({ pubkey });
		await user.fetchProfile();
		const profile = user.profile;
		return profile?.displayName || profile?.name || `User ${pubkey.slice(0, 8)}...`;
	} catch {
		return `User ${pubkey.slice(0, 8)}...`;
	}
}

/**
 * Formats a single message as markdown
 */
async function formatMessage(
	event: NDKEvent,
	ndk: NDK | undefined,
	profileCache: Map<string, string>
): Promise<string[]> {
	const lines: string[] = [];

	const timestamp = event.created_at ? new Date(event.created_at * 1000) : new Date();
	const formattedTime = timestamp.toLocaleString();

	// Get author info with caching
	const authorPubkey = event.pubkey;
	let authorName = profileCache.get(authorPubkey);
	if (!authorName) {
		authorName = await getProfileName(ndk, authorPubkey);
		profileCache.set(authorPubkey, authorName);
	}

	// Add message header
	lines.push(`## ${authorName}`);
	lines.push(`*${formattedTime}*`);
	lines.push('');

	// Add message content
	const content = event.content || '';
	const contentLines = content.split('\n');
	contentLines.forEach((line) => {
		lines.push(line);
	});
	lines.push('');

	return lines;
}

/**
 * Formats a thread as markdown - flat chronological list
 */
export async function formatThreadAsMarkdown(
	messages: Message[],
	rootEvent: NDKEvent | null,
	allThreadEvents: NDKEvent[] = [],
	ndk: NDK | undefined = undefined
): Promise<string> {
	if (!messages || messages.length === 0) {
		return '';
	}

	const lines: string[] = [];

	// Add thread title if available
	if (rootEvent) {
		const titleTag = rootEvent.tags?.find((tag: string[]) => tag[0] === 'title')?.[1];
		const title = titleTag || rootEvent.content?.split('\n')[0] || 'Thread';
		lines.push(`# ${title}`);
		lines.push('');
	}

	// Collect all events (from messages and allThreadEvents)
	const allEvents = [...messages.map((m) => m.event), ...allThreadEvents];

	// Remove duplicates based on event ID
	const uniqueEvents = Array.from(new Map(allEvents.map((e) => [e.id, e])).values());

	// Sort by timestamp (oldest first)
	const sortedEvents = uniqueEvents
		.filter((event) => event.created_at !== undefined)
		.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));

	// Cache profiles
	const profileCache = new Map<string, string>();

	// Format each message
	for (let index = 0; index < sortedEvents.length; index++) {
		const event = sortedEvents[index];
		const messageLines = await formatMessage(event, ndk, profileCache);
		lines.push(...messageLines);

		// Add separator between messages
		if (index < sortedEvents.length - 1) {
			lines.push('---');
			lines.push('');
		}
	}

	return lines.join('\n');
}

/**
 * Extract specific tags from an event
 */
function extractTags(event: NDKEvent): JSONMessage['tags'] {
	const tags: JSONMessage['tags'] = {};

	if (!event.tags) return tags;

	// Extract tool tags
	const toolTags = event.tags.filter((tag) => tag[0] === 'tool' && tag[1]);
	if (toolTags.length > 0) {
		tags.tool = toolTags.map((tag) => tag[1]);
	}

	// Extract p tags (mentions/recipients)
	const pTags = event.tags.filter((tag) => tag[0] === 'p' && tag[1]);
	if (pTags.length > 0) {
		tags.p = pTags.map((tag) => tag[1]);
	}

	return tags;
}

/**
 * Formats a single message as JSON object
 */
async function formatMessageAsJSONObject(
	event: NDKEvent,
	ndk: NDK | undefined,
	profileCache: Map<string, string>
): Promise<JSONMessage> {
	// Get author info with caching
	const authorPubkey = event.pubkey;
	let authorName = profileCache.get(authorPubkey);
	if (!authorName) {
		authorName = await getProfileName(ndk, authorPubkey);
		profileCache.set(authorPubkey, authorName);
	}

	const timestamp = event.created_at ? new Date(event.created_at * 1000) : new Date();

	return {
		id: event.id,
		author: authorName,
		timestamp: timestamp.toISOString(),
		content: event.content || '',
		tags: extractTags(event)
	};
}

/**
 * Formats a thread as JSON - flat chronological array
 */
export async function formatThreadAsJSON(
	messages: Message[],
	rootEvent: NDKEvent | null,
	allThreadEvents: NDKEvent[] = [],
	ndk: NDK | undefined = undefined
): Promise<string> {
	if (!messages || messages.length === 0) {
		return '[]';
	}

	// Collect all events
	const allEvents = [...messages.map((m) => m.event), ...allThreadEvents];

	// Remove duplicates based on event ID
	const uniqueEvents = Array.from(new Map(allEvents.map((e) => [e.id, e])).values());

	// Sort by timestamp (oldest first)
	const sortedEvents = uniqueEvents
		.filter((event) => event.created_at !== undefined)
		.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));

	// Cache profiles
	const profileCache = new Map<string, string>();

	// Format each message
	const threadMessages: JSONMessage[] = [];
	for (const event of sortedEvents) {
		const jsonMessage = await formatMessageAsJSONObject(event, ndk, profileCache);
		threadMessages.push(jsonMessage);
	}

	return JSON.stringify(threadMessages, null, 2);
}

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
