/**
 * VAD (Voice Activity Detection) controller using Svelte 5 runes
 *
 * THIS IS THE MAGIC! In React, this required tons of refs to avoid stale closures.
 * With Svelte 5 runes, callbacks can directly access reactive state - NO REFS NEEDED!
 *
 * REFACTORED TO CLASS-BASED FOR PROPER REACTIVITY
 */

import { VADService, type VADServiceOptions } from './vad-service';
import { AUDIO_CONFIG } from './audio-config';

export interface VADControllerOptions {
	enabled?: boolean;
	onSpeechStart?: () => void;
	onSpeechEnd?: () => void;
	onError?: (error: Error) => void;
	inputDeviceId?: string;
}

/**
 * VAD controller class using Svelte 5 runes
 * Public reactive fields are automatically tracked by Svelte!
 *
 * THE KEY WIN: Callbacks in createVADCallbacks() can directly access
 * reactive state (isActive, isPaused, etc.) without refs!
 */
export class VADController {
	// PUBLIC REACTIVE STATE - Svelte tracks these automatically!
	isActive = $state(false);
	isListening = $state(false);
	isPaused = $state(false);
	error = $state<string | null>(null);

	// Internal state (not reactive)
	private vadService: VADService | null = null;

	constructor(private options: VADControllerOptions = {}) {}

	/**
	 * Cleanup function
	 */
	private cleanup() {
		console.log(`[${performance.now().toFixed(2)}ms] [VADController] cleanup() called`);
		if (this.vadService) {
			console.log(`[${performance.now().toFixed(2)}ms] [VADController] Destroying VAD service`);
			this.vadService.destroy();
			this.vadService = null;
		}
		this.isActive = false;
		this.isListening = false;
		this.isPaused = false;
		console.log(`[${performance.now().toFixed(2)}ms] [VADController] cleanup() complete`);
	}

	/**
	 * Create VAD callbacks
	 *
	 * THE KEY DIFFERENCE FROM REACT:
	 * These callbacks can directly access reactive state (this.isPaused, etc.)
	 * without needing refs! Svelte's reactivity system handles it automatically.
	 */
	private createVADCallbacks(): VADServiceOptions {
		return {
			onSpeechStart: () => {
				const now = performance.now();
				console.log(
					`[${now.toFixed(2)}ms] [VADController] onSpeechStart - isPaused:`,
					this.isPaused
				);

				// Direct state access - no refs needed!
				if (!this.isPaused) {
					this.isListening = true;
					console.log(`[${now.toFixed(2)}ms] [VADController] Calling user onSpeechStart callback`);
					this.options.onSpeechStart?.();
				}
			},
			onSpeechEnd: () => {
				const now = performance.now();
				console.log(`[${now.toFixed(2)}ms] [VADController] onSpeechEnd`);
				this.isListening = false; // Direct state access!
				console.log(`[${now.toFixed(2)}ms] [VADController] Calling user onSpeechEnd callback`);
				this.options.onSpeechEnd?.();
			},
			onError: (err: Error) => {
				this.error = err.message; // Direct state access!
				this.options.onError?.(err);
				this.cleanup();
			}
		};
	}

	/**
	 * Get VAD settings from config
	 */
	private getVADSettings(): VADServiceOptions {
		return {
			positiveSpeechThreshold: AUDIO_CONFIG.VAD.POSITIVE_SPEECH_THRESHOLD,
			negativeSpeechThreshold: AUDIO_CONFIG.VAD.NEGATIVE_SPEECH_THRESHOLD,
			redemptionFrames: AUDIO_CONFIG.VAD.REDEMPTION_FRAMES,
			preSpeechPadFrames: AUDIO_CONFIG.VAD.PRE_SPEECH_PAD_FRAMES,
			minSpeechFrames: AUDIO_CONFIG.VAD.MIN_SPEECH_FRAMES
		};
	}

	/**
	 * Initialize VAD
	 */
	private async initialize(): Promise<void> {
		console.log(
			`[${performance.now().toFixed(2)}ms] [VADController] initialize() called - enabled:`,
			this.options.enabled,
			'hasService:',
			!!this.vadService
		);
		if (!this.options.enabled || this.vadService) return;

		try {
			const callbacks = this.createVADCallbacks();
			const settings = this.getVADSettings();

			const service = new VADService({
				...callbacks,
				...settings
			});

			this.vadService = service;

			const deviceId = this.options.inputDeviceId || undefined;
			await service.initialize(deviceId);
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Failed to initialize VAD';
			this.error = errorMessage;
			this.cleanup();
		}
	}

	/**
	 * Start VAD
	 */
	async start(): Promise<void> {
		console.log(
			`[${performance.now().toFixed(2)}ms] [VADController] start() called - enabled:`,
			this.options.enabled,
			'hasService:',
			!!this.vadService
		);
		if (!this.options.enabled) {
			this.error = 'VAD is disabled';
			return;
		}

		if (!this.vadService) {
			console.log(`[${performance.now().toFixed(2)}ms] [VADController] No VAD service, initializing...`);
			await this.initialize();
		}

		if (this.vadService) {
			try {
				console.log(`[${performance.now().toFixed(2)}ms] [VADController] Starting VAD service`);
				await this.vadService.start();
				this.isActive = true;
				this.error = null;
				this.isPaused = false;
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : 'Failed to start VAD';
				this.error = errorMessage;
			}
		}
	}

	/**
	 * Stop VAD
	 */
	stop(): void {
		console.log(`[${performance.now().toFixed(2)}ms] [VADController] stop() called`);
		if (this.vadService) {
			console.log(
				`[${performance.now().toFixed(2)}ms] [VADController] Destroying VAD service from stop()`
			);
			this.vadService.destroy();
			this.vadService = null;
		}
		this.isActive = false;
		this.isListening = false;
		this.isPaused = false;
		console.log(`[${performance.now().toFixed(2)}ms] [VADController] stop() complete`);
	}

	/**
	 * Pause VAD (temporarily stop listening)
	 */
	pause(): void {
		if (this.vadService && this.isActive) {
			this.vadService.pause();
			this.isPaused = true;
			this.isListening = false;
		}
	}

	/**
	 * Resume VAD (start listening again after pause)
	 */
	resume(): void {
		if (this.vadService && this.isActive && this.isPaused) {
			this.vadService.resume();
			this.isPaused = false;
		}
	}

	/**
	 * Destroy and cleanup resources
	 */
	destroy() {
		this.cleanup();
	}
}
