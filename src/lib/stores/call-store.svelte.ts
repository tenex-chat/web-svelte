/**
 * Unified Call Store using Svelte 5 runes
 * Composes all sub-controllers into a cohesive call management system
 * NO REFS NEEDED! Direct reactive state access with proper reactivity!
 */

import { VADController } from '$lib/audio/vad-controller.svelte';
import { AudioRecorder, type AudioRecorderOptions } from '$lib/audio/audio-recorder.svelte';
import { TTSPlayer, type TTSPlayerOptions } from '$lib/audio/tts-player.svelte';
import { TTSQueue, type TTSQueueOptions, type ChatMessage } from '$lib/audio/tts-queue.svelte';
import {
	MessagingController,
	type MessagingControllerOptions
} from '$lib/audio/messaging-controller.svelte';
import { callSettings } from '$lib/stores/call-settings.svelte';
import { aiConfigStore } from '$lib/stores/aiConfig.svelte';

export type CallState = 'initializing' | 'idle' | 'recording' | 'processing' | 'playing';

export interface CallStoreOptions {
	threadManagement: MessagingControllerOptions['threadManagement'];
	messages: ChatMessage[];
	userPubkey?: string;
	activeAgent?: MessagingControllerOptions['activeAgent'];
	onStateChange?: (state: CallState) => void;
}

/**
 * Unified Call Store class using Svelte 5 runes
 * This is the main controller that coordinates all call-related functionality
 */
export class CallStore {
	// PUBLIC REACTIVE STATE
	callState = $state<CallState>('initializing');
	transcript = $state('');
	error = $state<string | null>(null);

	// Sub-controllers
	vad: VADController;
	audioRecorder: AudioRecorder;
	ttsPlayer: TTSPlayer;
	ttsQueue: TTSQueue;
	messaging: MessagingController;

	constructor(private options: CallStoreOptions) {
		// Initialize audio recorder
		this.audioRecorder = new AudioRecorder({
			deviceId: callSettings.settings.inputDeviceId,
			audioSettings: callSettings.settings,
			onDataAvailable: (data) => {
				// Optional: process audio data for real-time visualization
			}
		});

		// Initialize TTS player
		this.ttsPlayer = new TTSPlayer({
			voiceSettings: aiConfigStore.config.voiceSettings,
			openAIApiKey: aiConfigStore.config.openAIApiKey,
			onPlaybackStateChange: (isPlaying) => {
				console.log(
					`[${performance.now().toFixed(2)}ms] [CallStore] TTS playback state changed:`,
					isPlaying
				);
				this.callState = isPlaying ? 'playing' : 'idle';
				this.options.onStateChange?.(this.callState);
			}
		});

		// Initialize TTS queue
		this.ttsQueue = new TTSQueue({
			enabled: true,
			ttsPlayer: this.ttsPlayer,
			userPubkey: options.userPubkey,
			onPlaybackStateChange: (isPlaying) => {
				this.callState = isPlaying ? 'playing' : 'idle';
				this.options.onStateChange?.(this.callState);
			}
		});

		// Initialize VAD with speech detection callbacks
		this.vad = new VADController({
			enabled: callSettings.isVADEnabled,
			onSpeechStart: () => this.handleSpeechStart(),
			onSpeechEnd: () => this.handleSpeechEnd(),
			onError: (error) => {
				console.error('[CallStore] VAD error:', error);
				this.error = error.message;
			},
			inputDeviceId: callSettings.settings.inputDeviceId || undefined
		});

		// Initialize messaging controller
		this.messaging = new MessagingController({
			threadManagement: options.threadManagement,
			messages: options.messages,
			activeAgent: options.activeAgent
		});

		// Set up $effect to monitor TTS player state and process queue
		$effect(() => {
			this.ttsQueue.monitorPlayerState();
		});

		// Set up $effect to process messages when they change
		$effect(() => {
			this.ttsQueue.processMessages(this.options.messages);
		});
	}

	/**
	 * Handle speech start from VAD
	 */
	private async handleSpeechStart(): Promise<void> {
		const now = performance.now();
		console.log(
			`[${now.toFixed(2)}ms] [CallStore] handleSpeechStart - current state:`,
			this.callState
		);

		// Stop any playing TTS
		if (this.ttsPlayer.isPlaying) {
			console.log(`[${now.toFixed(2)}ms] [CallStore] Stopping TTS playback`);
			this.ttsQueue.clearQueue();
		}

		// Start recording if not already recording/processing
		if (this.callState !== 'recording' && this.callState !== 'processing') {
			console.log(`[${now.toFixed(2)}ms] [CallStore] Starting recording`);
			this.callState = 'recording';
			this.options.onStateChange?.(this.callState);

			try {
				await this.audioRecorder.startRecording();
			} catch (error) {
				console.error('[CallStore] Failed to start recording:', error);
				this.error = error instanceof Error ? error.message : 'Failed to start recording';
				this.callState = 'idle';
				this.options.onStateChange?.(this.callState);
			}
		}
	}

	/**
	 * Handle speech end from VAD
	 */
	private async handleSpeechEnd(): Promise<void> {
		const now = performance.now();
		console.log(`[${now.toFixed(2)}ms] [CallStore] handleSpeechEnd - current state:`, this.callState);

		if (this.callState === 'recording') {
			console.log(`[${now.toFixed(2)}ms] [CallStore] Stopping recording`);

			try {
				const audioBlob = await this.audioRecorder.stopRecording();

				if (audioBlob) {
					console.log('[CallStore] Audio recorded, starting STT transcription');
					this.callState = 'processing';
					this.options.onStateChange?.(this.callState);

					// Transcribe audio to text
					const transcribedText = await this.transcribeAudio(audioBlob);

					if (transcribedText) {
						console.log('[CallStore] Transcription complete:', transcribedText);
						this.transcript = transcribedText;

						// Send the transcribed message
						await this.messaging.sendMessage(transcribedText);

						// Clear transcript and return to idle
						this.transcript = '';
					}

					this.callState = 'idle';
					this.options.onStateChange?.(this.callState);
				}
			} catch (error) {
				console.error('[CallStore] Failed to process audio:', error);
				this.error = error instanceof Error ? error.message : 'Failed to process audio';
				this.callState = 'idle';
				this.options.onStateChange?.(this.callState);
			}
		}
	}

	/**
	 * Transcribe audio blob to text using configured STT provider
	 */
	private async transcribeAudio(audioBlob: Blob): Promise<string> {
		const sttSettings = aiConfigStore.config.sttSettings;

		if (!sttSettings.enabled) {
			throw new Error('STT is not enabled in configuration');
		}

		// Determine API key based on provider
		const apiKey =
			sttSettings.provider === 'whisper'
				? aiConfigStore.config.openAIApiKey
				: aiConfigStore.config.voiceSettings.apiKey;

		if (!apiKey) {
			throw new Error(`API key required for ${sttSettings.provider} STT`);
		}

		// Import aiService dynamically to avoid circular dependencies
		const { aiService } = await import('$lib/services/ai-service');

		return aiService.transcribe(audioBlob, sttSettings.provider, apiKey);
	}

	/**
	 * Initialize the call (start VAD if enabled)
	 */
	async initialize(): Promise<void> {
		console.log('[CallStore] Initializing call');

		try {
			// Request microphone permission
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			stream.getTracks().forEach((track) => track.stop());

			// Start VAD if enabled
			if (callSettings.isVADEnabled) {
				await this.vad.start();
				console.log('[CallStore] VAD started');
			}

			this.callState = 'idle';
			this.options.onStateChange?.(this.callState);
		} catch (error) {
			console.error('[CallStore] Failed to initialize:', error);
			this.error = error instanceof Error ? error.message : 'Microphone access required';
			throw error;
		}
	}

	/**
	 * Start recording manually (for push-to-talk mode)
	 */
	async startRecording(): Promise<void> {
		if (this.callState !== 'idle') return;

		try {
			this.callState = 'recording';
			this.options.onStateChange?.(this.callState);
			await this.audioRecorder.startRecording();
		} catch (error) {
			console.error('[CallStore] Failed to start recording:', error);
			this.error = error instanceof Error ? error.message : 'Failed to start recording';
			this.callState = 'idle';
			this.options.onStateChange?.(this.callState);
		}
	}

	/**
	 * Stop recording manually (for push-to-talk mode)
	 */
	async stopRecording(): Promise<void> {
		if (this.callState !== 'recording') return;

		try {
			const audioBlob = await this.audioRecorder.stopRecording();

			if (audioBlob) {
				console.log('[CallStore] Audio recorded, starting STT transcription');
				this.callState = 'processing';
				this.options.onStateChange?.(this.callState);

				// Transcribe audio to text
				const transcribedText = await this.transcribeAudio(audioBlob);

				if (transcribedText) {
					console.log('[CallStore] Transcription complete:', transcribedText);
					// Store transcript for display but don't auto-send in manual mode
					// User can review and click send button
					this.transcript = transcribedText;
				}

				this.callState = 'idle';
				this.options.onStateChange?.(this.callState);
			}
		} catch (error) {
			console.error('[CallStore] Failed to stop recording:', error);
			this.error = error instanceof Error ? error.message : 'Failed to stop recording';
			this.callState = 'idle';
			this.options.onStateChange?.(this.callState);
		}
	}

	/**
	 * Send a text message (after transcription or manual input)
	 */
	async sendMessage(text: string): Promise<void> {
		if (!text.trim()) return;

		try {
			this.callState = 'processing';
			this.options.onStateChange?.(this.callState);

			await this.messaging.sendMessage(text);

			this.callState = 'idle';
			this.options.onStateChange?.(this.callState);
			this.transcript = '';
		} catch (error) {
			console.error('[CallStore] Failed to send message:', error);
			this.error = error instanceof Error ? error.message : 'Failed to send message';
			this.callState = 'idle';
			this.options.onStateChange?.(this.callState);
		}
	}

	/**
	 * Toggle microphone (for UI button)
	 */
	async toggleMicrophone(): Promise<void> {
		if (callSettings.isVADEnabled) {
			// In auto VAD mode, toggle pause/resume
			if (this.vad.isPaused) {
				this.vad.resume();
			} else {
				this.vad.pause();
			}
		} else {
			// In manual mode, toggle recording
			if (this.audioRecorder.isRecording) {
				await this.stopRecording();
			} else {
				await this.startRecording();
			}
		}
	}

	/**
	 * Update options (useful when messages, agent, etc. change)
	 */
	updateOptions(options: Partial<CallStoreOptions>): void {
		Object.assign(this.options, options);

		// Update messaging controller if relevant options changed
		if (options.threadManagement || options.messages || options.activeAgent) {
			this.messaging.updateOptions({
				threadManagement: options.threadManagement,
				messages: options.messages,
				activeAgent: options.activeAgent
			});
		}
	}

	/**
	 * Cleanup and destroy all resources
	 */
	destroy(): void {
		console.log('[CallStore] Destroying call store');

		this.vad.destroy();
		this.audioRecorder.destroy();
		this.ttsPlayer.destroy();
		this.ttsQueue.clearQueue();

		this.callState = 'initializing';
		this.transcript = '';
		this.error = null;
	}
}
