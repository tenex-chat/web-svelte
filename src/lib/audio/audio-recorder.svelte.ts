/**
 * Audio recorder controller using Svelte 5 runes
 * Handles microphone recording with audio level monitoring
 * NO REFS NEEDED! Direct reactive state access!
 *
 * REFACTORED TO CLASS-BASED FOR PROPER REACTIVITY
 */

import { audioResourceManager } from './audio-resource-manager';
import { AUDIO_CONFIG } from './audio-config';
import type { AudioSettings } from '$lib/stores/call-settings.svelte';

export interface AudioRecorderOptions {
	deviceId?: string | null;
	audioSettings: AudioSettings;
	onDataAvailable?: (data: Float32Array) => void;
}

/**
 * Audio recorder class using Svelte 5 runes
 * Public reactive fields are automatically tracked by Svelte!
 */
export class AudioRecorder {
	// PUBLIC REACTIVE STATE - Svelte tracks these automatically!
	isRecording = $state(false);
	audioLevel = $state(0);
	error = $state<string | null>(null);
	stream = $state<MediaStream | null>(null);

	// Internal state (not reactive, doesn't need to be)
	private mediaRecorder: MediaRecorder | null = null;
	private chunks: Blob[] = [];
	private analyser: AnalyserNode | null = null;
	private audioContext: AudioContext | null = null;
	private animationFrame = 0;
	private streamCacheKey = '';
	private readonly recorderId = `recorder-${Date.now()}`;

	constructor(private options: AudioRecorderOptions) {}

	/**
	 * Cleanup function
	 */
	private cleanup() {
		if (this.animationFrame) {
			cancelAnimationFrame(this.animationFrame);
			this.animationFrame = 0;
		}

		if (this.stream && this.streamCacheKey) {
			audioResourceManager.releaseMediaStream(this.streamCacheKey);
			this.stream = null;
			this.streamCacheKey = '';
		}

		if (this.audioContext) {
			audioResourceManager.releaseAudioContext();
			this.audioContext = null;
		}

		if (this.mediaRecorder) {
			audioResourceManager.releaseMediaRecorder(this.recorderId);
			this.mediaRecorder = null;
		}

		this.analyser = null;
		this.audioLevel = 0;
	}

	/**
	 * Monitor audio level
	 */
	private monitorAudioLevel() {
		if (!this.analyser) return;

		const bufferLength = this.analyser.frequencyBinCount;
		const dataArray = new Float32Array(bufferLength);

		const updateLevel = () => {
			if (!this.analyser) return;

			this.analyser.getFloatTimeDomainData(dataArray);

			// Calculate RMS (root mean square) for better level indication
			let sum = 0;
			for (let i = 0; i < bufferLength; i++) {
				sum += dataArray[i] * dataArray[i];
			}
			const rms = Math.sqrt(sum / bufferLength);
			const level = Math.min(1, rms * AUDIO_CONFIG.RECORDING.RMS_SCALE_FACTOR);

			this.audioLevel = level; // Direct state update - no setState needed!

			// Call callback if provided
			if (this.options.onDataAvailable) {
				this.options.onDataAvailable(dataArray);
			}

			// Continue animation loop while recording
			if (this.mediaRecorder?.state === 'recording' && this.analyser) {
				this.animationFrame = requestAnimationFrame(updateLevel);
			} else {
				// Stop animation and reset level
				if (this.animationFrame) {
					cancelAnimationFrame(this.animationFrame);
					this.animationFrame = 0;
				}
				this.audioLevel = 0;
			}
		};

		updateLevel();
	}

	/**
	 * Start recording
	 */
	async startRecording(): Promise<void> {
		const now = performance.now();
		console.log(`[${now.toFixed(2)}ms] [AudioRecorder] startRecording called`);

		try {
			this.cleanup(); // Clean up any existing recording
			this.error = null;
			this.chunks = [];

			// Get user media with specified device or default
			const constraints: MediaStreamConstraints = {
				audio: this.options.deviceId
					? {
							deviceId: { exact: this.options.deviceId },
							noiseSuppression: this.options.audioSettings.noiseSuppression,
							echoCancellation: this.options.audioSettings.echoCancellation,
							autoGainControl: this.options.audioSettings.voiceActivityDetection
						}
					: {
							noiseSuppression: this.options.audioSettings.noiseSuppression,
							echoCancellation: this.options.audioSettings.echoCancellation,
							autoGainControl: this.options.audioSettings.voiceActivityDetection
						}
			};

			// Get media stream through resource manager
			const cacheKey = `input-${this.options.deviceId || 'default'}`;
			const mediaStream = await audioResourceManager.getUserMedia(constraints, cacheKey);
			this.stream = mediaStream;
			this.streamCacheKey = cacheKey;

			// Get shared audio context
			this.audioContext = await audioResourceManager.getAudioContext();
			this.analyser = this.audioContext.createAnalyser();
			this.analyser.fftSize = AUDIO_CONFIG.RECORDING.FFT_SIZE;
			this.analyser.smoothingTimeConstant = AUDIO_CONFIG.RECORDING.SMOOTHING_TIME_CONSTANT;

			const source = this.audioContext.createMediaStreamSource(mediaStream);

			// Apply volume adjustment if needed
			if (this.options.audioSettings.inputVolume < 100) {
				const gainNode = this.audioContext.createGain();
				gainNode.gain.value = this.options.audioSettings.inputVolume / 100;
				source.connect(gainNode);
				gainNode.connect(this.analyser);
			} else {
				source.connect(this.analyser);
			}

			// Set up MediaRecorder through resource manager
			const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
			const recorder = audioResourceManager.createMediaRecorder(
				mediaStream,
				{ mimeType },
				this.recorderId
			);
			this.mediaRecorder = recorder;

			recorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					this.chunks.push(event.data);
				}
			};

			recorder.onerror = (event) => {
				const err = event as ErrorEvent;
				this.error = `Recording failed: ${err.message || 'Unknown error'}`;
				this.cleanup();
			};

			// Start recording
			recorder.start(AUDIO_CONFIG.RECORDING.CHUNK_INTERVAL_MS);
			this.isRecording = true;
			console.log(
				`[${performance.now().toFixed(2)}ms] [AudioRecorder] Recording started, state=${recorder.state}`
			);

			// Start monitoring audio levels
			this.monitorAudioLevel();
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Failed to start recording';
			this.error = errorMessage;
			this.isRecording = false;
			this.cleanup();
			throw err;
		}
	}

	/**
	 * Stop recording and return audio blob
	 */
	async stopRecording(): Promise<Blob | null> {
		const now = performance.now();
		const recorderState = this.mediaRecorder?.state;
		console.log(
			`[${now.toFixed(2)}ms] [AudioRecorder] stopRecording called, state=${recorderState}`
		);

		if (!this.mediaRecorder || this.mediaRecorder.state !== 'recording') {
			console.log(`[${now.toFixed(2)}ms] [AudioRecorder] Cannot stop - no recorder or not recording`);
			return null;
		}

		return new Promise((resolve) => {
			const recorder = this.mediaRecorder!;

			recorder.onstop = () => {
				const mimeType = recorder.mimeType || 'audio/webm';
				const blob = this.chunks.length > 0 ? new Blob(this.chunks, { type: mimeType }) : null;

				this.cleanup();
				resolve(blob);
			};

			console.log(`[${performance.now().toFixed(2)}ms] [AudioRecorder] Calling recorder.stop()`);
			recorder.stop();
			this.isRecording = false;
		});
	}

	/**
	 * Destroy and cleanup resources
	 */
	destroy() {
		this.cleanup();
	}
}
