/**
 * AI Service for TTS and STT functionality
 * Supports OpenAI (Whisper STT + TTS) and ElevenLabs (STT + TTS)
 */

import { voiceDiscovery } from './voice-discovery';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

export type TTSProvider = 'openai' | 'elevenlabs';
export type STTProvider = 'whisper' | 'elevenlabs';

class AIService {
	/**
	 * Generate speech from text (non-streaming)
	 * Returns complete audio as a Blob
	 */
	async speak(
		text: string,
		voiceId: string,
		provider: TTSProvider,
		apiKey: string
	): Promise<Blob> {
		return voiceDiscovery.previewVoice(provider, voiceId, text, apiKey);
	}

	/**
	 * Generate speech from text with streaming
	 * Calls onChunk for each audio chunk received
	 * Returns complete audio as a Blob when done
	 */
	async streamSpeak(
		text: string,
		voiceId: string,
		provider: TTSProvider,
		apiKey: string,
		onChunk?: (chunk: Uint8Array) => void
	): Promise<Blob> {
		return voiceDiscovery.streamVoice(provider, voiceId, text, apiKey, onChunk);
	}

	/**
	 * Transcribe audio to text using OpenAI Whisper or ElevenLabs STT
	 */
	async transcribe(audio: Blob, provider: STTProvider, apiKey: string): Promise<string> {
		switch (provider) {
			case 'whisper':
				return this.transcribeWithWhisper(audio, apiKey);
			case 'elevenlabs':
				return this.transcribeWithElevenLabs(audio, apiKey);
			default:
				throw new Error(`Unsupported STT provider: ${provider}`);
		}
	}

	/**
	 * OpenAI Whisper STT implementation
	 */
	private async transcribeWithWhisper(audio: Blob, apiKey: string): Promise<string> {
		const formData = new FormData();
		formData.append('file', audio, 'audio.webm');
		formData.append('model', 'whisper-1');

		const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiKey}`
			},
			body: formData
		});

		if (!response.ok) {
			throw new Error(`Whisper transcription failed: ${response.statusText}`);
		}

		const data = await response.json();
		return data.text;
	}

	/**
	 * ElevenLabs STT implementation
	 */
	private async transcribeWithElevenLabs(audio: Blob, apiKey: string): Promise<string> {
		const client = new ElevenLabsClient({ apiKey });

		try {
			// Convert Blob to File for the SDK
			const file = new File([audio], 'audio.webm', {
				type: audio.type || 'audio/webm'
			});

			// Use the ElevenLabs SDK for transcription
			const result = await client.speechToText.convert({
				file: file,
				model_id: 'scribe_v1',
				tag_audio_events: false,
				diarize: false
			});

			// Extract the transcribed text from the response
			if ('text' in result && result.text) {
				return result.text;
			} else if ('transcripts' in result && result.transcripts) {
				return result.transcripts.map((t: any) => t.text || '').join(' ');
			} else if ('transcriptionId' in result && result.transcriptionId) {
				throw new Error('Transcription sent to webhook, not available immediately');
			} else {
				console.warn('Unexpected ElevenLabs response structure:', result);
				throw new Error('Unable to extract transcription from ElevenLabs response');
			}
		} catch (error) {
			console.error('ElevenLabs transcription error:', error);
			throw error;
		}
	}
}

export const aiService = new AIService();
