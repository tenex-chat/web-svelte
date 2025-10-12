import { browser } from '$app/environment';

// Provider types
export type AIProvider = 'openai' | 'anthropic' | 'google' | 'openrouter' | 'custom';
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
		try {
			// Load main config
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				const parsed = JSON.parse(stored);
				this.config = { ...defaultConfig, ...parsed };
			}

			// Load LLM configs
			const llmConfigsStored = localStorage.getItem(LLM_CONFIGS_KEY);
			if (llmConfigsStored) {
				this.config.llmConfigs = JSON.parse(llmConfigsStored);
			}

			// Load active LLM config ID
			const activeLLMStored = localStorage.getItem(ACTIVE_LLM_KEY);
			if (activeLLMStored) {
				this.config.activeLLMConfigId = JSON.parse(activeLLMStored);
			}

			// Load UI LLM configs
			const uiLLMConfigsStored = localStorage.getItem(UI_LLM_CONFIGS_KEY);
			if (uiLLMConfigsStored) {
				this.config.uiLLMConfigs = JSON.parse(uiLLMConfigsStored);
			}
		} catch (error) {
			console.error('Failed to load AI config:', error);
		}
	}

	private save() {
		if (!browser) return;

		try {
			// Save main config
			localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
			// Save LLM configs separately
			localStorage.setItem(LLM_CONFIGS_KEY, JSON.stringify(this.config.llmConfigs));
			localStorage.setItem(ACTIVE_LLM_KEY, JSON.stringify(this.config.activeLLMConfigId));
			localStorage.setItem(UI_LLM_CONFIGS_KEY, JSON.stringify(this.config.uiLLMConfigs));
		} catch (error) {
			console.error('Failed to save AI config:', error);
		}
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
		this.save();
		if (browser) {
			localStorage.removeItem(STORAGE_KEY);
			localStorage.removeItem(LLM_CONFIGS_KEY);
			localStorage.removeItem(ACTIVE_LLM_KEY);
			localStorage.removeItem(UI_LLM_CONFIGS_KEY);
		}
	}
}

export const aiConfigStore = new AIConfigStore();
