import { NDKEvent } from '@nostr-dev-kit/ndk';
import { NDKKind } from '$lib/kinds';
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

// Track which streaming events have been finalized globally
// This prevents reprocessing of streaming events after their final message arrives
const finalizedStreamingIds = new Set<string>();

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
 * Processes a single event and updates streaming sessions (for non-streaming events)
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
	if (event.kind === NDKKind.TenexConversationMetadata) {
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

	// For all other events, add them as final messages
	// Note: streaming, typing, and final reply events are handled in processEventsToMessages
	if (event.kind !== NDKKind.TenexStreamingResponse &&
	    event.kind !== NDKKind.TenexAgentTypingStart &&
	    event.kind !== NDKKind.TenexAgentTypingStop &&
	    event.kind !== NDKKind.GenericReply) {
		finalMessages.push({ id: event.id, event });
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
		if (session.latestEvent.kind === NDKKind.TenexStreamingResponse) {
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
 * Processes all events into UI-ready messages with conversation-scoped streaming
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

	// Process each event chronologically
	for (const event of sortedEvents) {
		// Apply brainstorm filtering if needed
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
				// Show all: still hide kind:7 moderation events
				if (event.kind === 7) {
					continue;
				}
			}
		}

		// Apply view mode filtering for non-brainstorm
		if (!isBrainstorm && viewMode === 'threaded') {
			if (!isDirectReplyToRoot(event, rootEvent)) {
				continue;
			}
		}

		// Handle different event types
		if (event.kind === NDKKind.GenericReply) {
			// Final message (1111) - mark all prior streaming from this pubkey as finalized
			sortedEvents
				.filter(e =>
					e.kind === NDKKind.TenexStreamingResponse &&
					e.pubkey === event.pubkey &&
					e.created_at! < event.created_at!
				)
				.forEach(e => {
					finalizedStreamingIds.add(e.id);
					console.log('[MessageProcessor] Marking streaming event as finalized', {
						streamingId: e.id,
						pubkey: e.pubkey,
						finalMessageId: event.id
					});
				});

			// Clear any active streaming session for this pubkey
			if (streamingSessions.has(event.pubkey)) {
				console.log('[MessageProcessor] Clearing streaming session due to final message', {
					pubkey: event.pubkey,
					finalMessageId: event.id
				});
				streamingSessions.delete(event.pubkey);
			}

			// Add the final message
			finalMessages.push({ id: event.id, event });

		} else if (event.kind === NDKKind.TenexStreamingResponse) {
			// Streaming response (21111) - only process if not finalized
			if (finalizedStreamingIds.has(event.id)) {
				console.log('[MessageProcessor] Skipping finalized streaming event', {
					eventId: event.id,
					pubkey: event.pubkey
				});
				continue;
			}

			let session = streamingSessions.get(event.pubkey);
			if (!session) {
				// Create new streaming session
				const accumulator = new DeltaContentAccumulator();
				const reconstructedContent = accumulator.addEvent(event);
				const syntheticId = `streaming-${event.pubkey}-${event.created_at || Date.now()}`;

				session = {
					syntheticId,
					accumulator,
					latestEvent: event,
					reconstructedContent
				};
				streamingSessions.set(event.pubkey, session);

				console.log('[MessageProcessor] Created new streaming session', {
					pubkey: event.pubkey,
					syntheticId,
					contentLength: reconstructedContent?.length
				});
			} else {
				// Update existing session
				session.reconstructedContent = session.accumulator.addEvent(event);
				session.latestEvent = event;

				console.log('[MessageProcessor] Updated streaming session', {
					pubkey: event.pubkey,
					syntheticId: session.syntheticId,
					contentLength: session.reconstructedContent?.length
				});
			}

		} else if (event.kind === NDKKind.TenexAgentTypingStart) {
			// Typing indicator - create or update typing session
			let session = streamingSessions.get(event.pubkey);

			if (!session || session.syntheticId.startsWith('streaming-')) {
				// Create new typing session (or replace streaming with typing)
				const syntheticId = `typing-${event.pubkey}`;
				session = {
					syntheticId,
					accumulator: new DeltaContentAccumulator(), // Not used for typing
					latestEvent: event,
					reconstructedContent: event.content || 'typing...'
				};
				streamingSessions.set(event.pubkey, session);

				console.log('[MessageProcessor] Created typing indicator session', {
					pubkey: event.pubkey,
					syntheticId
				});
			} else {
				// Update existing typing session
				session.latestEvent = event;
				session.reconstructedContent = event.content || 'typing...';
			}

		} else if (event.kind === NDKKind.TenexAgentTypingStop) {
			// Stop typing - remove typing session
			const session = streamingSessions.get(event.pubkey);
			if (session?.syntheticId.startsWith('typing-')) {
				console.log('[MessageProcessor] Removing typing indicator session', {
					pubkey: event.pubkey
				});
				streamingSessions.delete(event.pubkey);
			}

		} else {
			// All other event types - process normally
			processEvent(event, streamingSessions, finalMessages);
		}
	}

	// Convert active streaming sessions to synthetic messages
	const streamingMessages = streamingSessionsToMessages(streamingSessions);

	console.log('[MessageProcessor] Converting streaming sessions to messages', {
		sessionCount: streamingSessions.size,
		streamingMessageCount: streamingMessages.length,
		sessions: Array.from(streamingSessions.entries()).map(([key, session]) => ({
			pubkey: key,
			syntheticId: session.syntheticId,
			contentLength: session.reconstructedContent?.length
		}))
	});

	// Apply brainstorm filtering to streaming messages if needed
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