import { DeltaContentAccumulator } from './DeltaContentAccumulator';
import type { NDKEvent } from '@nostr-dev-kit/ndk';
import { EVENT_KINDS } from '$lib/constants';

interface StreamingSession {
	syntheticId: string;
	accumulator: DeltaContentAccumulator;
	latestEvent: NDKEvent;
	reconstructedContent: string;
}

/**
 * Global store for managing streaming sessions across renders
 * This ensures we don't lose state when the component re-renders
 */
class StreamingMessageStore {
	// Use a reactive object instead of Map for proper Svelte reactivity
	sessions = $state<Record<string, StreamingSession>>({});

	/**
	 * Process a streaming event and return the current reconstructed content
	 */
	processStreamingEvent(event: NDKEvent): { syntheticId: string; content: string } | null {
		// Handle both streaming responses and typing indicators
		if (event.kind !== EVENT_KINDS.STREAMING_RESPONSE &&
		    event.kind !== EVENT_KINDS.TYPING_INDICATOR) {
			return null;
		}

		const key = event.pubkey;
		let session = this.sessions[key];

		// Handle typing indicators differently - they don't accumulate
		if (event.kind === EVENT_KINDS.TYPING_INDICATOR) {
			const syntheticId = `typing-${event.pubkey}`;

			if (!session || session.syntheticId !== syntheticId) {
				// Create new typing session
				session = {
					syntheticId,
					accumulator: new DeltaContentAccumulator(), // Not used for typing
					latestEvent: event,
					reconstructedContent: event.content || 'typing...'
				};

				console.log('[StreamingStore] Creating typing indicator session', {
					pubkey: event.pubkey,
					syntheticId
				});
			} else {
				// Update existing typing session
				session = {
					...session,
					latestEvent: event,
					reconstructedContent: event.content || 'typing...'
				};
			}

			// Trigger reactivity
			this.sessions = { ...this.sessions, [key]: session };

			return {
				syntheticId: session.syntheticId,
				content: session.reconstructedContent
			};
		}

		// Handle streaming responses with accumulation
		if (!session) {
			// Create new session
			const accumulator = new DeltaContentAccumulator();
			const reconstructedContent = accumulator.addEvent(event);
			const syntheticId = `streaming-${event.pubkey}`;

			session = {
				syntheticId,
				accumulator,
				latestEvent: event,
				reconstructedContent
			};

			console.log('[StreamingStore] Creating new session', {
				pubkey: event.pubkey,
				syntheticId,
				content: reconstructedContent?.substring(0, 100)
			});

			// Trigger reactivity by reassigning the object
			this.sessions = { ...this.sessions, [key]: session };
		} else {
			// Update existing session
			const updatedContent = session.accumulator.addEvent(event);

			// Create a new session object to trigger reactivity
			this.sessions = {
				...this.sessions,
				[key]: {
					...session,
					reconstructedContent: updatedContent,
					latestEvent: event
				}
			};

			console.log('[StreamingStore] Updating session', {
				pubkey: event.pubkey,
				syntheticId: session.syntheticId,
				deltaContent: event.content,
				totalContent: updatedContent?.substring(0, 100),
				totalLength: updatedContent?.length,
				deltaCount: session.accumulator.getDeltaCount()
			});
		}

		return {
			syntheticId: this.sessions[key].syntheticId,
			content: this.sessions[key].reconstructedContent
		};
	}

	/**
	 * Clear a streaming session when the final message arrives
	 */
	clearSession(pubkey: string): void {
		if (this.sessions[pubkey]) {
			console.log('[StreamingStore] Clearing session for', pubkey);
			// Create new object without the cleared session to trigger reactivity
			const { [pubkey]: _, ...remainingSessions } = this.sessions;
			this.sessions = remainingSessions;
		}
	}

	/**
	 * Get active streaming session for a pubkey
	 */
	getSession(pubkey: string): StreamingSession | undefined {
		return this.sessions[pubkey];
	}

	/**
	 * Get all active sessions as an array of [key, session] pairs
	 * Returns array instead of Map for better reactivity
	 */
	getAllSessions(): Array<[string, StreamingSession]> {
		return Object.entries(this.sessions);
	}

	/**
	 * Clear all sessions
	 */
	clearAll(): void {
		console.log('[StreamingStore] Clearing all sessions');
		this.sessions = {};
	}
}

// Export a singleton instance
export const streamingMessageStore = new StreamingMessageStore();