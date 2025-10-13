/**
 * AI Service stub for TTS functionality
 * Full implementation to be added later with complete LLM, STT, and TTS support
 */

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
		// TODO: Implement full TTS generation
		// For now, throw an error indicating this needs implementation
		throw new Error('TTS speak method not yet implemented. Please add voice discovery service.');
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
		// TODO: Implement streaming TTS generation
		// For now, throw an error indicating this needs implementation
		throw new Error(
			'TTS streamSpeak method not yet implemented. Please add voice discovery service.'
		);
	}

	/**
	 * Transcribe audio to text
	 */
	async transcribe(audio: Blob, provider: STTProvider, apiKey: string): Promise<string> {
		// TODO: Implement STT transcription
		throw new Error('STT transcribe method not yet implemented.');
	}
}

export const aiService = new AIService();
