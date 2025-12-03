import type { AIProvider } from '$lib/stores/aiConfig.svelte';

export interface ModelInfo {
	id: string;
	name?: string;
	description?: string;
	contextLength?: number;
}

// Simple in-memory cache with 24-hour TTL
const cache = new Map<string, { models: ModelInfo[]; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetches available models for a given provider
 */
export async function fetchModels(
	provider: AIProvider,
	apiKey: string,
	baseUrl?: string
): Promise<ModelInfo[]> {
	const cacheKey = `${provider}-${apiKey.slice(-4)}`;
	const cached = cache.get(cacheKey);

	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		return cached.models;
	}

	let models: ModelInfo[] = [];

	try {
		switch (provider) {
			case 'openai':
				models = await fetchOpenAIModels(apiKey, baseUrl);
				break;
			case 'openrouter':
				models = await fetchOpenRouterModels(apiKey);
				break;
			case 'anthropic':
				models = getAnthropicModels();
				break;
			case 'google':
				models = getGoogleModels();
				break;
			case 'ollama':
				models = await fetchOllamaModels(baseUrl || 'http://localhost:11434');
				break;
			case 'custom':
				// Try OpenAI-compatible endpoint
				models = await fetchOpenAIModels(apiKey, baseUrl);
				break;
			default:
				throw new Error(`Unsupported provider: ${provider}`);
		}

		cache.set(cacheKey, { models, timestamp: Date.now() });
		return models;
	} catch (error) {
		console.error(`Failed to fetch models for ${provider}:`, error);
		throw error;
	}
}

/**
 * Fetch models from OpenAI API
 */
async function fetchOpenAIModels(apiKey: string, baseUrl?: string): Promise<ModelInfo[]> {
	const url = baseUrl ? `${baseUrl}/v1/models` : 'https://api.openai.com/v1/models';

	const response = await fetch(url, {
		headers: {
			Authorization: `Bearer ${apiKey}`
		}
	});

	if (!response.ok) {
		throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
	}

	const data = await response.json();

	return data.data
		.map((model: any) => ({
			id: model.id,
			name: model.id,
			description: model.owned_by ? `Owned by ${model.owned_by}` : undefined
		}))
		.sort((a: ModelInfo, b: ModelInfo) => a.id.localeCompare(b.id));
}

/**
 * Fetch models from OpenRouter API
 */
async function fetchOpenRouterModels(apiKey: string): Promise<ModelInfo[]> {
	const response = await fetch('https://openrouter.ai/api/v1/models', {
		headers: {
			Authorization: `Bearer ${apiKey}`
		}
	});

	if (!response.ok) {
		throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
	}

	const data = await response.json();

	return data.data
		.map((model: any) => ({
			id: model.id,
			name: model.name || model.id,
			description: model.description,
			contextLength: model.context_length
		}))
		.sort((a: ModelInfo, b: ModelInfo) => a.id.localeCompare(b.id));
}

/**
 * Get hardcoded list of Anthropic models (no public API)
 */
function getAnthropicModels(): ModelInfo[] {
	return [
		{
			id: 'claude-3-5-sonnet-20241022',
			name: 'Claude 3.5 Sonnet',
			description: 'Most intelligent model',
			contextLength: 200000
		},
		{
			id: 'claude-3-5-haiku-20241022',
			name: 'Claude 3.5 Haiku',
			description: 'Fastest model',
			contextLength: 200000
		},
		{
			id: 'claude-3-opus-20240229',
			name: 'Claude 3 Opus',
			description: 'Previous generation flagship',
			contextLength: 200000
		},
		{
			id: 'claude-3-sonnet-20240229',
			name: 'Claude 3 Sonnet',
			description: 'Balanced performance',
			contextLength: 200000
		},
		{
			id: 'claude-3-haiku-20240307',
			name: 'Claude 3 Haiku',
			description: 'Fast and compact',
			contextLength: 200000
		}
	];
}

/**
 * Get hardcoded list of Google models (no public API)
 */
function getGoogleModels(): ModelInfo[] {
	return [
		{
			id: 'gemini-2.0-flash-exp',
			name: 'Gemini 2.0 Flash (Experimental)',
			description: 'Latest experimental model',
			contextLength: 1000000
		},
		{
			id: 'gemini-1.5-pro',
			name: 'Gemini 1.5 Pro',
			description: 'Most capable model',
			contextLength: 2000000
		},
		{
			id: 'gemini-1.5-flash',
			name: 'Gemini 1.5 Flash',
			description: 'Fast and efficient',
			contextLength: 1000000
		},
		{
			id: 'gemini-pro',
			name: 'Gemini Pro',
			description: 'General purpose model',
			contextLength: 32000
		}
	];
}

/**
 * Fetch models from Ollama API
 * Ollama runs locally by default at http://localhost:11434
 */
async function fetchOllamaModels(baseUrl: string): Promise<ModelInfo[]> {
	const url = `${baseUrl}/api/tags`;

	try {
		const response = await fetch(url);

		if (!response.ok) {
			if (response.status === 0 || !response.status) {
				throw new Error(
					'Cannot connect to Ollama. Is Ollama running? Start it with: ollama serve'
				);
			}
			throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();

		if (!data.models || !Array.isArray(data.models)) {
			return [];
		}

		return data.models
			.map((model: any) => ({
				id: model.name || model.model,
				name: model.name || model.model,
				description: model.size ? `Size: ${formatBytes(model.size)}` : undefined
			}))
			.sort((a: ModelInfo, b: ModelInfo) => a.id.localeCompare(b.id));
	} catch (error) {
		if (error instanceof TypeError && error.message.includes('fetch')) {
			throw new Error(
				'Cannot connect to Ollama. Is Ollama running? Start it with: ollama serve'
			);
		}
		throw error;
	}
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 Bytes';
	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
