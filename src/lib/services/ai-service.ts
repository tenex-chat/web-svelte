/**
 * AI Service for TTS and STT functionality
 * Supports OpenAI (Whisper STT + TTS) and ElevenLabs (STT + TTS)
 */

import { voiceDiscovery } from './voice-discovery';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { generateText } from 'ai';
import { providerRegistry, type ProviderConfig } from './provider-registry';
import type { ImageGenSettings } from '$lib/stores/aiConfig.svelte';

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
				modelId: 'scribe_v1',
				tagAudioEvents: false,
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

	/**
	 * Generate a concise title for a conversation
	 */
	async generateTitle(messages: string[], config?: ProviderConfig): Promise<string> {
		if (!config) {
			return messages[0]?.slice(0, 50) || 'Untitled Conversation';
		}

		try {
			let provider = providerRegistry.getProvider(config.id);

			if (!provider) {
				provider = providerRegistry.createProvider(config);
			}

			const model = config.model || this.getDefaultModel(config.provider);
			const conversationPreview = messages.slice(0, 5).join('\n---\n');

			const { text: title } = await generateText({
				model: provider(model),
				prompt: `Generate a concise, descriptive title (max 50 characters) for this conversation. Return only the title, no quotes or additional text.

Conversation:
${conversationPreview}`,
				temperature: 0.7
			});

			return title.trim().slice(0, 50);
		} catch (error) {
			console.error('Title generation error:', error);
			return messages[0]?.slice(0, 50) || 'Untitled Conversation';
		}
	}

	/**
	 * Generate a comprehensive summary of a conversation
	 */
	async summarizeConversation(
		messages: Array<{ author: string; content: string; timestamp?: number }>,
		config?: ProviderConfig
	): Promise<string> {
		if (!config) {
			throw new Error('No AI provider configured. Please configure an LLM in Settings.');
		}

		try {
			let provider = providerRegistry.getProvider(config.id);

			if (!provider) {
				provider = providerRegistry.createProvider(config);
			}

			if (typeof provider !== 'function') {
				throw new Error(
					'AI provider not properly initialized. Please reconfigure your LLM settings.'
				);
			}

			const model = config.model || this.getDefaultModel(config.provider);

			// Format messages with author names and limit to ~12000 chars (~3000 tokens)
			let conversationText = '';
			let charCount = 0;
			const maxChars = 12000;

			for (let i = messages.length - 1; i >= 0 && charCount < maxChars; i--) {
				const msg = messages[i];
				const formatted = `${msg.author}: ${msg.content}\n\n`;
				if (charCount + formatted.length > maxChars) {
					break;
				}
				conversationText = formatted + conversationText;
				charCount += formatted.length;
			}

			if (messages.length > 0 && charCount >= maxChars) {
				conversationText = `[Earlier messages truncated]\n\n${conversationText}`;
			}

			const { text: summary } = await generateText({
				model: provider(model),
				prompt: `You are an expert at summarizing conversations. Create a comprehensive summary of the following conversation that captures the key points, decisions, and outcomes. Focus on the most important information and maintain clarity.

The summary should:
- Be concise but informative (aim for 2-4 paragraphs)
- Highlight key topics discussed
- Note any decisions made or action items
- Capture the overall tone and purpose

Conversation:
${conversationText}

Summary:`,
				temperature: 0.5
			});

			return summary.trim();
		} catch (error) {
			console.error('Conversation summarization error:', error);
			throw error;
		}
	}

	/**
	 * Get default model for a provider
	 */
	private getDefaultModel(provider: string): string {
		switch (provider) {
			case 'openai':
				return 'gpt-4o-mini';
			case 'anthropic':
				return 'claude-3-haiku-20240307';
			case 'google':
				return 'gemini-1.5-flash';
			case 'openrouter':
				return 'openai/gpt-4o-mini';
			case 'ollama':
				return 'llama3.2';
			default:
				return '';
		}
	}

	/**
	 * Generate an image using the configured image generation provider
	 * Returns the image URL or base64 data
	 */
	async generateImage(
		prompt: string,
		settings: ImageGenSettings,
		apiKey: string
	): Promise<{ url?: string; base64?: string; error?: string }> {
		if (!settings.model) {
			return { error: 'No image model configured' };
		}

		if (!apiKey) {
			return { error: 'No API key available for image generation' };
		}

		try {
			// Currently only OpenRouter is supported
			if (settings.provider === 'openrouter') {
				return await this.generateImageWithOpenRouter(prompt, settings, apiKey);
			}

			return { error: `Unsupported image provider: ${settings.provider}` };
		} catch (error) {
			console.error('Image generation error:', error);
			return { error: error instanceof Error ? error.message : 'Image generation failed' };
		}
	}

	/**
	 * Generate image using OpenRouter API
	 */
	private async generateImageWithOpenRouter(
		prompt: string,
		settings: ImageGenSettings,
		apiKey: string
	): Promise<{ url?: string; base64?: string; error?: string }> {
		const response = await fetch('https://openrouter.ai/api/v1/images/generations', {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
				'HTTP-Referer': window.location.origin,
				'X-Title': 'TENEX'
			},
			body: JSON.stringify({
				model: settings.model,
				prompt: prompt,
				size: settings.size || '1024x1024',
				n: settings.n || 1,
				...(settings.quality && { quality: settings.quality }),
				...(settings.style && { style: settings.style })
			})
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			const errorMessage = errorData.error?.message || response.statusText;
			throw new Error(`OpenRouter image generation failed: ${errorMessage}`);
		}

		const data = await response.json();

		// OpenRouter returns data in OpenAI-compatible format
		if (data.data && data.data.length > 0) {
			const result = data.data[0];
			if (result.url) {
				return { url: result.url };
			}
			if (result.b64_json) {
				return { base64: result.b64_json };
			}
		}

		return { error: 'No image data in response' };
	}
}

export const aiService = new AIService();
