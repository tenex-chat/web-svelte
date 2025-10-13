/**
 * TTS Queue manager using Svelte 5 runes
 * Handles automatic TTS playback of agent messages with smart initialization
 * NO REFS NEEDED! Direct reactive state access!
 */

import type { TTSPlayer } from './tts-player.svelte';
import { extractTTSContent } from '$lib/utils/extract-tts-content';
import type { NDKEvent } from '@nostr-dev-kit/ndk';

export interface TTSMessage {
	content: string;
	id: string;
	pubkey: string;
}

export interface ChatMessage {
	id: string;
	event: NDKEvent;
}

export interface TTSQueueOptions {
	enabled: boolean;
	ttsPlayer: TTSPlayer;
	userPubkey?: string;
	onPlaybackStateChange?: (isPlaying: boolean) => void;
}

/**
 * TTS Queue manager class using Svelte 5 runes
 * Manages automatic playback of agent messages
 */
export class TTSQueue {
	// REACTIVE STATE
	isProcessing = $state(false);

	// Internal state (not reactive)
	private queue: TTSMessage[] = [];
	private playedMessageIds = new Set<string>();
	private isInitialLoad = true;

	constructor(private options: TTSQueueOptions) {}

	/**
	 * Process messages for auto-play
	 * This should be called whenever messages change
	 */
	processMessages(messages: ChatMessage[]): void {
		const now = performance.now();
		console.log(
			`[${now.toFixed(2)}ms] [TTSQueue] processMessages called, messages:`,
			messages.length,
			'isInitialLoad:',
			this.isInitialLoad
		);

		// Initial load: mark all existing messages as played to prevent history replay
		if (this.isInitialLoad && messages.length > 0) {
			console.log(
				`[${now.toFixed(2)}ms] [TTSQueue] Initial load - marking`,
				messages.length,
				'messages as played'
			);
			messages.forEach((msg) => this.playedMessageIds.add(msg.id));
			this.isInitialLoad = false;
			return;
		}

		// Skip if disabled or no TTS support
		if (
			!this.options.enabled ||
			!this.options.ttsPlayer.hasTTS ||
			!this.options.userPubkey
		) {
			console.log(
				`[${now.toFixed(2)}ms] [TTSQueue] Skipping - enabled:`,
				this.options.enabled,
				'hasTTS:',
				this.options.ttsPlayer.hasTTS,
				'userPubkey:',
				!!this.options.userPubkey
			);
			return;
		}

		// Filter messages to play
		const messagesToPlay = messages
			.filter((msg) => {
				const isAgentMessage = msg.event.pubkey !== this.options.userPubkey;
				const isNotPlayed = !this.playedMessageIds.has(msg.id);
				const isNotReasoning = !msg.event.tags.some((tag) => tag[0] === 'reasoning');
				const isCorrectKind = msg.event.kind === 1111;

				if (!isAgentMessage)
					console.log(`[${now.toFixed(2)}ms] [TTSQueue] Skipping user message:`, msg.id);
				if (!isNotPlayed)
					console.log(`[${now.toFixed(2)}ms] [TTSQueue] Already played:`, msg.id);
				if (!isNotReasoning)
					console.log(`[${now.toFixed(2)}ms] [TTSQueue] Reasoning message:`, msg.id);
				if (!isCorrectKind)
					console.log(
						`[${now.toFixed(2)}ms] [TTSQueue] Wrong kind:`,
						msg.event.kind,
						'for',
						msg.id
					);

				return isAgentMessage && isNotPlayed && isNotReasoning && isCorrectKind;
			})
			.map((msg) => ({
				content: extractTTSContent(msg.event.content),
				id: msg.id,
				pubkey: msg.event.pubkey
			}))
			.filter((msg) => msg.content);

		console.log(`[${now.toFixed(2)}ms] [TTSQueue] Messages to play:`, messagesToPlay.length);
		messagesToPlay.forEach((msg) => {
			console.log(
				`[${now.toFixed(2)}ms] [TTSQueue] Adding to queue:`,
				msg.id,
				'content preview:',
				msg.content.substring(0, 50)
			);
			this.addToQueue(msg);
		});
	}

	/**
	 * Add message to queue if not already played
	 */
	private addToQueue(message: TTSMessage): void {
		const now = performance.now();
		console.log(`[${now.toFixed(2)}ms] [TTSQueue] addToQueue called for:`, message.id);

		if (!this.playedMessageIds.has(message.id)) {
			console.log(
				`[${now.toFixed(2)}ms] [TTSQueue] Adding message to queue and marking as played:`,
				message.id
			);
			this.playedMessageIds.add(message.id);
			this.queue.push(message);
			this.processNextInQueue();
		} else {
			console.log(`[${now.toFixed(2)}ms] [TTSQueue] Message already played, skipping:`, message.id);
		}
	}

	/**
	 * Process next message in queue
	 */
	private async processNextInQueue(): Promise<void> {
		const now = performance.now();

		// Don't process if already processing or queue is empty or player is playing
		if (this.isProcessing || this.queue.length === 0 || this.options.ttsPlayer.isPlaying) {
			console.log(
				`[${now.toFixed(2)}ms] [TTSQueue] Skipping queue processing - isProcessing:`,
				this.isProcessing,
				'queueLength:',
				this.queue.length,
				'isPlaying:',
				this.options.ttsPlayer.isPlaying
			);
			return;
		}

		this.isProcessing = true;
		const nextMessage = this.queue.shift();

		if (!nextMessage) {
			this.isProcessing = false;
			return;
		}

		try {
			console.log(`[${now.toFixed(2)}ms] [TTSQueue] Starting playback for:`, nextMessage.id);
			this.options.onPlaybackStateChange?.(true);

			await this.options.ttsPlayer.play(
				nextMessage.content,
				nextMessage.id,
				nextMessage.pubkey
			);

			console.log(`[${now.toFixed(2)}ms] [TTSQueue] Playback completed for:`, nextMessage.id);
			this.options.onPlaybackStateChange?.(false);
			this.isProcessing = false;

			// Process next message after short delay
			setTimeout(() => this.processNextInQueue(), 100);
		} catch (error) {
			console.error(`[${now.toFixed(2)}ms] [TTSQueue] TTS playback failed:`, error);
			this.options.onPlaybackStateChange?.(false);
			this.isProcessing = false;

			// Continue to next message even if this one failed
			setTimeout(() => this.processNextInQueue(), 100);
		}
	}

	/**
	 * Monitor TTS player state and process queue when playback ends
	 * This should be called in an $effect to react to player state changes
	 */
	monitorPlayerState(): void {
		if (
			!this.options.ttsPlayer.isPlaying &&
			!this.isProcessing &&
			this.queue.length > 0
		) {
			this.processNextInQueue();
		}
	}

	/**
	 * Clear queue and stop playback
	 */
	clearQueue(): void {
		this.queue = [];
		this.isProcessing = false;
		this.options.ttsPlayer.stop();
	}

	/**
	 * Reset initialization state (for testing or manual reset)
	 */
	resetInitialization(): void {
		this.isInitialLoad = true;
		this.playedMessageIds.clear();
	}
}
