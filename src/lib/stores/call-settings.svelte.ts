/**
 * Call settings store using Svelte 5 runes
 * Manages audio/call configuration with persistent storage
 */

import { browser } from '$app/environment';

export type VADMode = 'disabled' | 'auto' | 'push-to-talk';
export type InterruptionMode = 'disabled' | 'headphones';
export type InterruptionSensitivity = 'low' | 'medium' | 'high';

export interface AudioSettings {
	// Device selection
	inputDeviceId: string | null;
	outputDeviceId: string | null;

	// Audio processing
	inputVolume: number; // 0-100
	noiseSuppression: boolean;
	echoCancellation: boolean;
	voiceActivityDetection: boolean;
	vadSensitivity: number; // 0-100, lower = more sensitive

	// VAD mode for conversation flow
	vadMode: VADMode;

	// Interruption settings
	interruptionMode: InterruptionMode;
	interruptionSensitivity: InterruptionSensitivity;
}

const DEFAULT_SETTINGS: AudioSettings = {
	inputDeviceId: null,
	outputDeviceId: null,
	inputVolume: 100,
	noiseSuppression: true,
	echoCancellation: true,
	voiceActivityDetection: true,
	vadSensitivity: 50,
	vadMode: 'push-to-talk',
	interruptionMode: 'disabled',
	interruptionSensitivity: 'medium'
};

const STORAGE_KEY = 'tenex:call-settings';

/**
 * Load settings from localStorage
 */
function loadSettings(): AudioSettings {
	if (!browser) return DEFAULT_SETTINGS;

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
		}
	} catch (error) {
		console.error('Failed to load call settings:', error);
	}

	return DEFAULT_SETTINGS;
}

/**
 * Save settings to localStorage
 */
function saveSettings(settings: AudioSettings): void {
	if (!browser) return;

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
	} catch (error) {
		console.error('Failed to save call settings:', error);
	}
}

/**
 * Call settings store class using runes
 * This demonstrates the power of runes - no useState, useEffect, or refs needed!
 */
class CallSettingsStore {
	settings = $state<AudioSettings>(loadSettings());

	// Derived values (computed automatically, no useMemo needed!)
	isVADEnabled = $derived(this.settings.vadMode === 'auto');
	isPushToTalk = $derived(this.settings.vadMode === 'push-to-talk');

	// Track initialization to skip auto-save on first run
	#initialized = false;

	// Auto-save on changes (no useEffect needed!)
	constructor() {
		$effect(() => {
			// Skip the initial run (when settings are first loaded)
			if (!this.#initialized) {
				this.#initialized = true;
				return;
			}

			// This runs whenever this.settings changes (after initialization)
			saveSettings(this.settings);
		});
	}

	/**
	 * Update settings (partial update)
	 */
	update(updates: Partial<AudioSettings>): void {
		this.settings = { ...this.settings, ...updates };
	}

	/**
	 * Update a single setting
	 */
	set<K extends keyof AudioSettings>(key: K, value: AudioSettings[K]): void {
		this.settings = { ...this.settings, [key]: value };
	}

	/**
	 * Reset to defaults
	 */
	reset(): void {
		this.settings = { ...DEFAULT_SETTINGS };
	}

	/**
	 * Set VAD mode
	 */
	setVADMode(mode: VADMode): void {
		this.set('vadMode', mode);
	}

	/**
	 * Set input device
	 */
	setInputDevice(deviceId: string | null): void {
		this.set('inputDeviceId', deviceId);
	}

	/**
	 * Set output device
	 */
	setOutputDevice(deviceId: string | null): void {
		this.set('outputDeviceId', deviceId);
	}

	/**
	 * Set input volume (0-100)
	 */
	setInputVolume(volume: number): void {
		this.set('inputVolume', Math.max(0, Math.min(100, volume)));
	}

	/**
	 * Set VAD sensitivity (0-100, lower = more sensitive)
	 */
	setVADSensitivity(sensitivity: number): void {
		this.set('vadSensitivity', Math.max(0, Math.min(100, sensitivity)));
	}

	/**
	 * Set interruption mode
	 */
	setInterruptionMode(mode: InterruptionMode): void {
		this.set('interruptionMode', mode);
	}

	/**
	 * Set interruption sensitivity
	 */
	setInterruptionSensitivity(sensitivity: InterruptionSensitivity): void {
		this.set('interruptionSensitivity', sensitivity);
	}

	/**
	 * Toggle boolean settings
	 */
	toggleNoiseSuppression(): void {
		this.set('noiseSuppression', !this.settings.noiseSuppression);
	}

	toggleEchoCancellation(): void {
		this.set('echoCancellation', !this.settings.echoCancellation);
	}

	toggleVoiceActivityDetection(): void {
		this.set('voiceActivityDetection', !this.settings.voiceActivityDetection);
	}
}

// Export singleton instance
export const callSettings = new CallSettingsStore();
