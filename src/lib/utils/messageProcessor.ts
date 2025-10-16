import { NDKEvent, NDKKind } from '@nostr-dev-kit/ndk';
import { EVENT_KINDS } from '$lib/constants';
import { DeltaContentAccumulator } from './DeltaContentAccumulator';

export type ThreadViewMode = 'threaded' | 'flattened';

export interface Message {
	id: string;
	event: NDKEvent;
	isReactComponent?: boolean;
	reactComponentCode?: string;
	reactComponentProps?: Record<string, any>;
}

interface StreamingSession {
	syntheticId: string;
	latestEvent: NDKEvent;
	accumulator: DeltaContentAccumulator;
	reconstructedContent: string;
}

/**
 * Sorts events by creation time and kind
 */
export function sortEvents(events: NDKEvent[]): NDKEvent[] {
	return [...events].sort((a, b) => {
		const timeA = a.created_at ?? 0;
		const timeB = b.created_at ?? 0;

		if (timeA !== timeB) {
			return timeA - timeB;
		}

		// Secondary sort: by kind (descending)
		const kindA = a.kind ?? 0;
		const kindB = b.kind ?? 0;
		return kindB - kindA;
	});
}

/**
 * Processes a single event and updates streaming sessions
 */
export function processEvent(
	event: NDKEvent,
	streamingSessions: Map<string, StreamingSession>,
	finalMessages: Message[]
): void {
	// Skip operations events
	if (event.kind === 24133 || event.kind === 24134) {
		return;
	}

	// Metadata events always shown
	if (event.kind === EVENT_KINDS.CONVERSATION_METADATA) {
		finalMessages.push({ id: event.id, event });
		return;
	}

	// Check for React component events
	if (event.kind === NDKKind.GenericReply) {
		const componentTag = event.tags.find((tag) => tag[0] === 'component' && tag[1] === 'react');
		if (componentTag) {
			const propsTag = event.tags.find((tag) => tag[0] === 'props')?.[1];
			let reactComponentProps: Record<string, any> | undefined;
			if (propsTag) {
				try {
					reactComponentProps = JSON.parse(propsTag);
				} catch {
					reactComponentProps = undefined;
				}
			}

			finalMessages.push({
				id: event.id,
				event,
				isReactComponent: true,
				reactComponentCode: event.content,
				reactComponentProps
			});
			return;
		}
	}

	// Handle streaming responses
	if (event.kind === EVENT_KINDS.STREAMING_RESPONSE) {
		let session = streamingSessions.get(event.pubkey);

		if (!session) {
			const accumulator = new DeltaContentAccumulator();
			const reconstructedContent = accumulator.addEvent(event);

			session = {
				syntheticId: `streaming-${event.pubkey}-${Date.now()}`,
				latestEvent: event,
				accumulator,
				reconstructedContent
			};
			streamingSessions.set(event.pubkey, session);
		} else {
			session.reconstructedContent = session.accumulator.addEvent(event);
			session.latestEvent = event;
		}
	} else if (event.kind === EVENT_KINDS.TYPING_INDICATOR) {
		let session = streamingSessions.get(event.pubkey);

		if (!session) {
			session = {
				syntheticId: `streaming-${event.pubkey}-${Date.now()}`,
				latestEvent: event,
				accumulator: new DeltaContentAccumulator(),
				reconstructedContent: event.content
			};
			streamingSessions.set(event.pubkey, session);
		} else {
			session.latestEvent = event;
			session.reconstructedContent = event.content;
		}
	} else if (event.kind === EVENT_KINDS.TYPING_INDICATOR_STOP) {
		const session = streamingSessions.get(event.pubkey);
		if (session?.latestEvent?.kind === EVENT_KINDS.TYPING_INDICATOR) {
			streamingSessions.delete(event.pubkey);
		}
	} else {
		finalMessages.push({ id: event.id, event });
		if (event.kind === NDKKind.GenericReply) {
			streamingSessions.delete(event.pubkey);
		}
	}
}

/**
 * Converts streaming sessions to synthetic messages
 */
export function streamingSessionsToMessages(
	streamingSessions: Map<string, StreamingSession>
): Message[] {
	const messages: Message[] = [];
	streamingSessions.forEach((session) => {
		if (session.latestEvent.kind === EVENT_KINDS.STREAMING_RESPONSE) {
			// Create synthetic event with reconstructed content
			const syntheticEvent = new NDKEvent(session.latestEvent.ndk);
			syntheticEvent.kind = session.latestEvent.kind;
			syntheticEvent.pubkey = session.latestEvent.pubkey;
			syntheticEvent.created_at = session.latestEvent.created_at;
			syntheticEvent.tags = session.latestEvent.tags;
			syntheticEvent.content = session.reconstructedContent;
			syntheticEvent.id = session.latestEvent.id;
			syntheticEvent.sig = session.latestEvent.sig;

			messages.push({
				id: session.syntheticId,
				event: syntheticEvent
			});
		} else {
			messages.push({
				id: session.syntheticId,
				event: session.latestEvent
			});
		}
	});
	return messages;
}

/**
 * Checks if event is a direct reply to root
 */
function isDirectReplyToRoot(event: NDKEvent, rootEvent: NDKEvent | null): boolean {
	if (!rootEvent) return true;
	if (event.id === rootEvent.id) return true;

	const eTags = event.getMatchingTags('e');
	return eTags.some((tag) => tag[1] === rootEvent.id);
}

/**
 * Gets moderator selections from kind:7 reaction events
 */
function getModeratorSelections(events: NDKEvent[], rootEvent: NDKEvent | null): Set<string> {
	if (!rootEvent) return new Set();

	const selectedEventIds = new Set<string>();

	for (const event of events) {
		if (event.kind !== 7) continue;

		const rootETag = event.tagValue('E');
		if (rootETag === rootEvent.id) {
			const eTags = event.getMatchingTags('e');
			for (const tag of eTags) {
				const selectedEventId = tag[1];
				if (selectedEventId && selectedEventId !== rootEvent.id) {
					selectedEventIds.add(selectedEventId);
				}
			}
		}
	}

	return selectedEventIds;
}

/**
 * Checks if event should be shown in brainstorm mode
 */
function shouldShowInBrainstormMode(
	event: NDKEvent,
	rootEvent: NDKEvent | null,
	selectedEventIds: Set<string>,
	hasModeratorSelections: boolean,
	currentUserPubkey?: string
): boolean {
	if (!rootEvent) return false;

	// Always show root
	if (event.id === rootEvent.id) return true;

	// Always show current user's messages
	if (currentUserPubkey && event.pubkey === currentUserPubkey) return true;

	// Never show kind:7 selections in UI
	if (event.kind === 7) return false;

	// If no selections yet, only show root and user messages
	if (!hasModeratorSelections) return false;

	// Show only selected events
	return selectedEventIds.has(event.id);
}

/**
 * Processes all events into UI-ready messages
 */
export function processEventsToMessages(
	events: NDKEvent[],
	rootEvent: NDKEvent | null = null,
	viewMode: ThreadViewMode = 'threaded',
	isBrainstorm = false,
	showAll = false,
	currentUserPubkey?: string
): Message[] {
	const finalMessages: Message[] = [];
	const streamingSessions = new Map<string, StreamingSession>();

	const sortedEvents = sortEvents(events);

	// Find root if not provided
	if (!rootEvent && sortedEvents.length > 0) {
		rootEvent =
			sortedEvents.find((event) => {
				if (event.kind === 11) return true;
				const eTags = event.getMatchingTags('e');
				return eTags.length === 0;
			}) || sortedEvents[0];
	}

	// Get moderator selections for brainstorm
	let selectedEventIds: Set<string> = new Set();
	if (isBrainstorm) {
		selectedEventIds = getModeratorSelections(sortedEvents, rootEvent);
	}
	const hasModeratorSelections = selectedEventIds.size > 0;

	// Process each event
	for (const event of sortedEvents) {
		if (isBrainstorm) {
			if (!showAll) {
				const shouldShow = shouldShowInBrainstormMode(
					event,
					rootEvent,
					selectedEventIds,
					hasModeratorSelections,
					currentUserPubkey
				);
				if (!shouldShow) {
					if (streamingSessions.has(event.pubkey)) {
						streamingSessions.delete(event.pubkey);
					}
					continue;
				}
			} else {
				// Show all: still hide kind:7 and streaming
				if (event.kind === 7 || event.kind === EVENT_KINDS.STREAMING_RESPONSE) {
					continue;
				}
			}
			processEvent(event, streamingSessions, finalMessages);
		} else {
			if (viewMode === 'flattened') {
				processEvent(event, streamingSessions, finalMessages);
			} else {
				// Threaded: only direct replies to root
				if (isDirectReplyToRoot(event, rootEvent)) {
					processEvent(event, streamingSessions, finalMessages);
				}
			}
		}
	}

	// Add streaming sessions
	const streamingMessages = streamingSessionsToMessages(streamingSessions);
	if (isBrainstorm && !showAll) {
		streamingMessages.forEach((msg) => {
			if (
				shouldShowInBrainstormMode(
					msg.event,
					rootEvent,
					selectedEventIds,
					hasModeratorSelections,
					currentUserPubkey
				)
			) {
				finalMessages.push(msg);
			}
		});
	} else {
		finalMessages.push(...streamingMessages);
	}

	// Sort by timestamp with tag priority
	const messagesWithTime = finalMessages
		.filter((msg) => msg.event.created_at !== undefined)
		.sort((a, b) => {
			const timeDiff = a.event.created_at! - b.event.created_at!;
			if (timeDiff === 0) {
				const aHasReasoning = a.event.hasTag('reasoning');
				const bHasReasoning = b.event.hasTag('reasoning');
				const aHasTool = a.event.hasTag('tool');
				const bHasTool = b.event.hasTag('tool');

				if (aHasReasoning && !bHasReasoning) return -1;
				if (!aHasReasoning && bHasReasoning) return 1;

				if (aHasTool && !bHasTool) return -1;
				if (!aHasTool && bHasTool) return 1;
			}
			return timeDiff;
		});

	return messagesWithTime;
}
