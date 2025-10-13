/**
 * Messaging controller for call view using Svelte 5 runes
 * Handles thread creation and message sending with voice mode tagging
 * NO REFS NEEDED! Direct reactive state access!
 */

import type { NDKEvent } from '@nostr-dev-kit/ndk';

export interface AgentInstance {
	pubkey: string;
	slug: string;
}

export interface ImageUpload {
	url: string;
	metadata?: {
		sha256: string;
		mimeType: string;
		size: number;
		blurhash?: string;
	};
}

export interface ThreadManagement {
	localRootEvent: NDKEvent | null;
	createThread: (
		content: string,
		mentions: AgentInstance[],
		images: ImageUpload[],
		autoTTS: boolean,
		selectedAgent: string | null
	) => Promise<NDKEvent | null>;
	sendReply: (
		content: string,
		mentions: AgentInstance[],
		images: ImageUpload[],
		autoTTS: boolean,
		messages: any[],
		selectedAgent: string | null
	) => Promise<NDKEvent | null>;
}

export interface MessagingControllerOptions {
	threadManagement: ThreadManagement;
	messages: any[];
	activeAgent?: AgentInstance;
}

/**
 * Messaging controller class using Svelte 5 runes
 * Manages message sending in call view context
 */
export class MessagingController {
	// PUBLIC REACTIVE STATE - Svelte tracks these automatically!
	rootEvent = $state<NDKEvent | null>(null);
	isProcessing = $state(false);

	constructor(private options: MessagingControllerOptions) {
		this.rootEvent = options.threadManagement.localRootEvent;
	}

	/**
	 * Create a new thread with the first message
	 */
	private async createNewThread(message: string): Promise<NDKEvent | null> {
		if (!this.options.activeAgent) {
			console.error('[MessagingController] No active agent available');
			return null;
		}

		console.log('[MessagingController] Creating new thread with message:', message);

		const newThread = await this.options.threadManagement.createThread(
			message,
			[this.options.activeAgent],
			[], // images
			true, // autoTTS - always true for call view
			this.options.activeAgent.pubkey
		);

		if (newThread) {
			console.log('[MessagingController] New thread created:', newThread.id);
			this.rootEvent = newThread;
		}

		return newThread;
	}

	/**
	 * Send a reply to the existing thread
	 */
	private async sendReplyToThread(message: string): Promise<void> {
		if (!this.options.activeAgent) {
			console.error('[MessagingController] No active agent available');
			return;
		}

		console.log('[MessagingController] Sending reply to thread:', this.rootEvent?.id);

		await this.options.threadManagement.sendReply(
			message,
			[this.options.activeAgent],
			[], // images
			true, // autoTTS - always true for call view
			this.options.messages,
			this.options.activeAgent.pubkey
		);
	}

	/**
	 * Send a message (creates thread if needed, otherwise sends reply)
	 * This is the main method that components should call
	 */
	async sendMessage(text: string): Promise<void> {
		if (!text.trim() || !this.options.activeAgent || this.isProcessing) {
			console.warn('[MessagingController] Cannot send message - conditions not met', {
				hasText: !!text.trim(),
				hasAgent: !!this.options.activeAgent,
				isProcessing: this.isProcessing
			});
			return;
		}

		this.isProcessing = true;

		try {
			// Get latest root event from thread management
			const currentRoot = this.options.threadManagement.localRootEvent;

			if (!currentRoot && !this.rootEvent) {
				// No thread exists yet - create one
				await this.createNewThread(text);
			} else {
				// Thread exists - send reply
				await this.sendReplyToThread(text);
			}
		} catch (error) {
			console.error('[MessagingController] Failed to send message:', error);
			throw error; // Re-throw to let caller handle error (e.g., show toast)
		} finally {
			this.isProcessing = false;
		}
	}

	/**
	 * Update options (useful when active agent changes)
	 */
	updateOptions(options: Partial<MessagingControllerOptions>): void {
		Object.assign(this.options, options);

		// Update root event if thread management changed
		if (options.threadManagement) {
			this.rootEvent = options.threadManagement.localRootEvent;
		}
	}
}
