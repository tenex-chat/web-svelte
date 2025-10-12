import type { TTSProvider } from '$lib/stores/aiConfig.svelte';

export interface VoiceInfo {
	id: string;
	name: string;
	description?: string;
	labels?: Record<string, string>;
	previewUrl?: string;
}

// Simple in-memory cache with 24-hour TTL
const cache = new Map<string, { voices: VoiceInfo[]; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetches available voices for a given provider
 */
export async function fetchVoices(
	provider: TTSProvider,
	apiKey?: string
): Promise<VoiceInfo[]> {
	const cacheKey = `${provider}-${apiKey?.slice(-4) || 'default'}`;
	const cached = cache.get(cacheKey);

	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		return cached.voices;
	}

	let voices: VoiceInfo[] = [];

	try {
		switch (provider) {
			case 'openai':
				voices = getOpenAIVoices();
				break;
			case 'elevenlabs':
				if (!apiKey) {
					throw new Error('ElevenLabs API key required');
				}
				voices = await fetchElevenLabsVoices(apiKey);
				break;
			default:
				throw new Error(`Unsupported provider: ${provider}`);
		}

		cache.set(cacheKey, { voices, timestamp: Date.now() });
		return voices;
	} catch (error) {
		console.error(`Failed to fetch voices for ${provider}:`, error);
		throw error;
	}
}

/**
 * Get hardcoded list of OpenAI voices
 */
function getOpenAIVoices(): VoiceInfo[] {
	return [
		{
			id: 'alloy',
			name: 'Alloy',
			description: 'Neutral and balanced'
		},
		{
			id: 'echo',
			name: 'Echo',
			description: 'Male, warm'
		},
		{
			id: 'fable',
			name: 'Fable',
			description: 'Male, expressive'
		},
		{
			id: 'onyx',
			name: 'Onyx',
			description: 'Male, deep'
		},
		{
			id: 'nova',
			name: 'Nova',
			description: 'Female, energetic'
		},
		{
			id: 'shimmer',
			name: 'Shimmer',
			description: 'Female, soft'
		}
	];
}

/**
 * Fetch voices from ElevenLabs API
 */
async function fetchElevenLabsVoices(apiKey: string): Promise<VoiceInfo[]> {
	const response = await fetch('https://api.elevenlabs.io/v1/voices', {
		headers: {
			'xi-api-key': apiKey
		}
	});

	if (!response.ok) {
		throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
	}

	const data = await response.json();

	return data.voices.map((voice: any) => ({
		id: voice.voice_id,
		name: voice.name,
		description: voice.description,
		labels: voice.labels,
		previewUrl: voice.preview_url
	}));
}

/**
 * Preview a voice by generating and playing sample audio
 */
export async function previewVoice(
	provider: TTSProvider,
	voiceId: string,
	apiKey?: string
): Promise<void> {
	const sampleText = 'Hello! This is a preview of my voice. How does it sound?';

	try {
		let audioBlob: Blob;

		switch (provider) {
			case 'openai':
				audioBlob = await previewOpenAIVoice(voiceId, sampleText, apiKey);
				break;
			case 'elevenlabs':
				if (!apiKey) {
					throw new Error('ElevenLabs API key required');
				}
				audioBlob = await previewElevenLabsVoice(voiceId, sampleText, apiKey);
				break;
			default:
				throw new Error(`Unsupported provider: ${provider}`);
		}

		// Play the audio
		const audioUrl = URL.createObjectURL(audioBlob);
		const audio = new Audio(audioUrl);
		audio.play();

		// Clean up after playback
		audio.onended = () => {
			URL.revokeObjectURL(audioUrl);
		};
	} catch (error) {
		console.error(`Failed to preview voice for ${provider}:`, error);
		throw error;
	}
}

/**
 * Generate preview audio using OpenAI TTS
 */
async function previewOpenAIVoice(
	voiceId: string,
	text: string,
	apiKey?: string
): Promise<Blob> {
	if (!apiKey) {
		throw new Error('OpenAI API key required');
	}

	const response = await fetch('https://api.openai.com/v1/audio/speech', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			model: 'tts-1',
			voice: voiceId,
			input: text
		})
	});

	if (!response.ok) {
		throw new Error(`OpenAI TTS error: ${response.status} ${response.statusText}`);
	}

	return await response.blob();
}

/**
 * Generate preview audio using ElevenLabs TTS
 */
async function previewElevenLabsVoice(
	voiceId: string,
	text: string,
	apiKey: string
): Promise<Blob> {
	const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
		method: 'POST',
		headers: {
			'xi-api-key': apiKey,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			text,
			model_id: 'eleven_monolingual_v1'
		})
	});

	if (!response.ok) {
		throw new Error(`ElevenLabs TTS error: ${response.status} ${response.statusText}`);
	}

	return await response.blob();
}
