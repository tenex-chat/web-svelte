/**
 * TTS Player controller using Svelte 5 runes
 * Manages text-to-speech playback with reactive state
 * NO REFS NEEDED! Direct reactive state access!
 */

import { ttsManager, type TTSOptions } from './tts-manager';
import { AUDIO_CONFIG } from './audio-config';
import { extractTTSContent } from '$lib/utils/extract-tts-content';
import type { VoiceSettings } from '$lib/stores/aiConfig.svelte';

export interface TTSPlayerOptions {
	voiceSettings: VoiceSettings;
	openAIApiKey?: string;
	onPlaybackStateChange?: (isPlaying: boolean) => void;
}

/**
 * TTS Player class using Svelte 5 runes
 * Public reactive fields are automatically tracked by Svelte!
 */
export class TTSPlayer {
	// PUBLIC REACTIVE STATE - Svelte tracks these automatically!
	isPlaying = $state(false);
	isPaused = $state(false);
	currentMessageId = $state<string | null>(null);
	currentContent = $state<string | null>(null);
	currentTime = $state(0);
	duration = $state(0);
	isLoading = $state(false);
	error = $state<string | null>(null);

	// Derived state
	progressPercentage = $derived(
		this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0
	);
	hasTTS = $derived(this.options.voiceSettings.enabled);

	constructor(private options: TTSPlayerOptions) {}

	/**
	 * Play text-to-speech
	 */
	async play(
		content: string,
		messageId: string,
		authorPubkey?: string,
		voiceId?: string,
		provider?: 'openai' | 'elevenlabs'
	): Promise<void> {
		if (!this.hasTTS || !content) {
			return;
		}

		// Stop current playback if any
		ttsManager.stop();
		this.currentMessageId = messageId;

		const ttsContent = extractTTSContent(content);
		if (!ttsContent) {
			return;
		}

		try {
			this.isLoading = true;
			this.error = null;
			this.currentMessageId = messageId;
			this.currentContent = ttsContent;
			this.isPlaying = false;
			this.isPaused = false;
			this.currentTime = 0;
			this.duration = 0;

			// Determine API key
			const selectedProvider = provider || this.options.voiceSettings.provider;
			const apiKey =
				selectedProvider === 'openai'
					? this.options.openAIApiKey
					: this.options.voiceSettings.apiKey;

			if (!apiKey) {
				throw new Error(`${selectedProvider} API key required`);
			}

			// Build TTS options
			const ttsOptions: TTSOptions = {
				voiceId: voiceId || this.options.voiceSettings.voiceIds?.[0] || 'alloy',
				provider: selectedProvider,
				apiKey,
				playbackRate: this.options.voiceSettings.speed,
				volume: AUDIO_CONFIG.PLAYBACK.DEFAULT_VOLUME,
				onProgress: (currentTime, duration) => {
					this.currentTime = currentTime;
					if (!isNaN(duration) && duration > 0) {
						this.duration = duration;
					}
				},
				onError: (error) => {
					this.error = error.message;
					this.isLoading = false;
					this.stop();
				},
				onEnd: () => {
					this.stop();
					this.options.onPlaybackStateChange?.(false);
				}
			};

			// Use TTS manager for playback
			await ttsManager.play(ttsContent, authorPubkey || messageId, ttsOptions);

			this.isPlaying = true;
			this.isPaused = false;
			this.isLoading = false;
			this.options.onPlaybackStateChange?.(true);
		} catch (error) {
			this.error = error instanceof Error ? error.message : 'TTS playback failed';
			this.isLoading = false;
			this.stop();
			this.options.onPlaybackStateChange?.(false);
		}
	}

	/**
	 * Stop playback
	 */
	stop(): void {
		ttsManager.stop();
		this.isPlaying = false;
		this.isPaused = false;
		this.currentTime = 0;
		this.duration = 0;
		this.currentMessageId = null;
		this.currentContent = null;
	}

	/**
	 * Pause playback
	 */
	pause(): void {
		if (this.isPlaying) {
			ttsManager.pause();
			this.isPlaying = false;
			this.isPaused = true;
		}
	}

	/**
	 * Resume playback
	 */
	resume(): void {
		if (this.isPaused) {
			ttsManager.resume();
			this.isPlaying = true;
			this.isPaused = false;
		}
	}

	/**
	 * Toggle play/pause
	 */
	togglePlayPause(): void {
		if (this.isPlaying) {
			this.pause();
		} else if (this.isPaused) {
			this.resume();
		}
	}

	/**
	 * Seek to specific time
	 */
	seek(time: number): void {
		ttsManager.seek(time);
		this.currentTime = time;
	}

	/**
	 * Set playback rate
	 */
	setPlaybackRate(rate: number): void {
		ttsManager.setPlaybackRate(rate);
	}

	/**
	 * Set volume
	 */
	setVolume(volume: number): void {
		ttsManager.setVolume(volume);
	}

	/**
	 * Destroy and cleanup resources
	 */
	destroy(): void {
		ttsManager.cleanup();
		this.stop();
	}
}
