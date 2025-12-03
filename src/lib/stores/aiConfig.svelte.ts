import { browser } from '$app/environment';
import { storage } from '$lib/utils/storage.svelte';

// Provider types
export type AIProvider = 'openai' | 'anthropic' | 'google' | 'openrouter' | 'ollama' | 'custom';
export type TTSProvider = 'openai' | 'elevenlabs';
export type STTProvider = 'whisper' | 'elevenlabs';

// LLM Configuration
export interface LLMConfig {
	id: string;
	name: string;
	provider: AIProvider;
	model: string;
	apiKey: string;
	baseUrl?: string; // For custom providers
}

// Voice/TTS Configuration
export interface VoiceSettings {
	enabled: boolean;
	provider: TTSProvider;
	voiceIds: string[];
	apiKey?: string; // For ElevenLabs
	speed: number;
	autoSpeak: boolean;
}

// STT Configuration
export interface STTSettings {
	enabled: boolean;
	provider: STTProvider;
	model: string;
}

// UI-specific LLM configurations
export interface UILLMConfigs {
	titleGeneration?: string;
	summaries?: string;
}

// Full AI configuration
export interface AIConfig {
	llmConfigs: LLMConfig[];
	activeLLMConfigId: string | null;
	voiceSettings: VoiceSettings;
	sttSettings: STTSettings;
	openAIApiKey?: string;
	uiLLMConfigs: UILLMConfigs;
}

const STORAGE_KEY = 'ai-config-v2';
const LLM_CONFIGS_KEY = 'llm-configs';
const ACTIVE_LLM_KEY = 'active-llm-config-id';
const UI_LLM_CONFIGS_KEY = 'ui-llm-configs';

const defaultConfig: AIConfig = {
	llmConfigs: [],
	activeLLMConfigId: null,
	voiceSettings: {
		enabled: false,
		provider: 'openai',
		voiceIds: ['alloy'],
		speed: 1.0,
		autoSpeak: false
	},
	sttSettings: {
		enabled: false,
		provider: 'whisper',
		model: 'whisper-1'
	},
	uiLLMConfigs: {}
};

class AIConfigStore {
	config = $state<AIConfig>(defaultConfig);

	constructor() {
		if (browser) {
			this.load();
		}
	}

	private load() {
		// Load main config
		const stored = storage.get('ai-config-v2');
		if (stored) {
			this.config = { ...defaultConfig, ...stored };
		}

		// Load LLM configs
		const llmConfigsStored = storage.get('llm-configs');
		if (llmConfigsStored) {
			this.config.llmConfigs = llmConfigsStored;
		}

		// Load active LLM config ID
		const activeLLMStored = storage.get('active-llm-config-id');
		if (activeLLMStored !== undefined) {
			this.config.activeLLMConfigId = activeLLMStored;
		}

		// Load UI LLM configs
		const uiLLMConfigsStored = storage.get('ui-llm-configs');
		if (uiLLMConfigsStored) {
			this.config.uiLLMConfigs = uiLLMConfigsStored;
		}
	}

	private save() {
		if (!browser) return;

		// Save main config
		storage.set('ai-config-v2', this.config);
		// Save LLM configs separately
		storage.set('llm-configs', this.config.llmConfigs);
		storage.set('active-llm-config-id', this.config.activeLLMConfigId);
		storage.set('ui-llm-configs', this.config.uiLLMConfigs);
	}

	// LLM Configuration Methods
	addLLMConfig(config: LLMConfig) {
		this.config.llmConfigs = [...this.config.llmConfigs, config];
		// If first config, make it active
		if (this.config.llmConfigs.length === 1) {
			this.config.activeLLMConfigId = config.id;
		}
		this.save();
	}

	removeLLMConfig(id: string) {
		this.config.llmConfigs = this.config.llmConfigs.filter((c) => c.id !== id);
		// If removed config was active, select first remaining
		if (this.config.activeLLMConfigId === id) {
			this.config.activeLLMConfigId =
				this.config.llmConfigs.length > 0 ? this.config.llmConfigs[0].id : null;
		}
		this.save();
	}

	setActiveLLMConfig(id: string) {
		this.config.activeLLMConfigId = id;
		this.save();
	}

	getActiveLLMConfig(): LLMConfig | null {
		if (!this.config.activeLLMConfigId) {
			return this.config.llmConfigs.length > 0 ? this.config.llmConfigs[0] : null;
		}
		return this.config.llmConfigs.find((c) => c.id === this.config.activeLLMConfigId) || null;
	}

	// Voice Settings Methods
	updateVoiceSettings(settings: Partial<VoiceSettings>) {
		this.config.voiceSettings = { ...this.config.voiceSettings, ...settings };
		this.save();
	}

	// STT Settings Methods
	updateSTTSettings(settings: Partial<STTSettings>) {
		this.config.sttSettings = { ...this.config.sttSettings, ...settings };
		this.save();
	}

	// OpenAI API Key (shared between LLM and voice)
	setOpenAIApiKey(key: string) {
		this.config.openAIApiKey = key;
		this.save();
	}

	// UI LLM Configs
	updateUILLMConfigs(configs: Partial<UILLMConfigs>) {
		this.config.uiLLMConfigs = { ...this.config.uiLLMConfigs, ...configs };
		this.save();
	}

	// Reset to defaults
	reset() {
		this.config = { ...defaultConfig };
		if (browser) {
			storage.remove('ai-config-v2');
			storage.remove('llm-configs');
			storage.remove('active-llm-config-id');
			storage.remove('ui-llm-configs');
		}
	}
}

export const aiConfigStore = new AIConfigStore();
