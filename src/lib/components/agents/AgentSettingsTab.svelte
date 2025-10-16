<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import { Volume2, Settings2, Save } from 'lucide-svelte';

	interface Props {
		pubkey: string;
		agentDef: NDKEvent | undefined;
	}

	let { pubkey }: Props = $props();

	const AGENT_VOICE_STORAGE_KEY = 'agent-voice-configs';

	interface AgentVoiceConfig {
		voiceId: string;
		provider: 'openai' | 'elevenlabs';
		speed?: number;
	}

	// Load voice settings from localStorage
	function loadVoiceConfig(): AgentVoiceConfig | null {
		try {
			const stored = localStorage.getItem(AGENT_VOICE_STORAGE_KEY);
			if (!stored) return null;
			const configs = JSON.parse(stored);
			return configs[pubkey] || null;
		} catch {
			return null;
		}
	}

	// Save voice settings to localStorage
	function saveVoiceConfig(config: AgentVoiceConfig) {
		try {
			const stored = localStorage.getItem(AGENT_VOICE_STORAGE_KEY);
			const configs = stored ? JSON.parse(stored) : {};
			configs[pubkey] = config;
			localStorage.setItem(AGENT_VOICE_STORAGE_KEY, JSON.stringify(configs));
		} catch (error) {
			console.error('[AgentSettingsTab] Failed to save voice config:', error);
		}
	}

	// Initialize with saved config or defaults
	const savedConfig = loadVoiceConfig();
	let voiceProvider = $state<'openai' | 'elevenlabs'>(savedConfig?.provider || 'openai');
	let voiceId = $state(savedConfig?.voiceId || '');
	let voiceSpeed = $state(savedConfig?.speed || 1.0);

	let isSaving = $state(false);

	async function handleSaveSettings() {
		isSaving = true;
		try {
			// Save voice settings to localStorage
			saveVoiceConfig({
				voiceId,
				provider: voiceProvider,
				speed: voiceSpeed
			});
			console.log('[AgentSettingsTab] Settings saved successfully for agent:', pubkey);
		} catch (error) {
			console.error('[AgentSettingsTab] Failed to save settings:', error);
		} finally {
			setTimeout(() => {
				isSaving = false;
			}, 1000);
		}
	}

	async function handleTestVoice() {
		// TODO: Implement TTS preview using the selected voice
		console.log('[AgentSettingsTab] Testing voice:', voiceId, voiceProvider);
	}

	function handleResetVoice() {
		try {
			const stored = localStorage.getItem(AGENT_VOICE_STORAGE_KEY);
			if (stored) {
				const configs = JSON.parse(stored);
				delete configs[pubkey];
				localStorage.setItem(AGENT_VOICE_STORAGE_KEY, JSON.stringify(configs));
			}

			// Reset to defaults
			voiceProvider = 'openai';
			voiceId = '';
			voiceSpeed = 1.0;

			console.log('[AgentSettingsTab] Voice settings reset to global defaults');
		} catch (error) {
			console.error('[AgentSettingsTab] Failed to reset voice settings:', error);
		}
	}
</script>

<div class="space-y-6">
	<!-- Voice Settings Card -->
	<div class="bg-card border border-border rounded-lg">
		<div class="px-4 py-3 border-b border-border">
			<div class="flex items-center gap-2">
				<Volume2 class="w-5 h-5 text-foreground" />
				<h3 class="font-semibold text-foreground">Voice Settings</h3>
			</div>
			<p class="text-sm text-muted-foreground mt-1">
				Configure the voice for this agent
			</p>
		</div>
		<div class="px-4 py-4 space-y-4">
			<!-- Voice Provider -->
			<div class="space-y-2">
				<label class="text-sm font-medium text-foreground">Voice Provider</label>
				<select
					bind:value={voiceProvider}
					class="w-full px-3 py-2 border border-border bg-white dark:bg-zinc-800 text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
				>
					<option value="openai">OpenAI</option>
					<option value="elevenlabs">ElevenLabs</option>
				</select>
			</div>

			<!-- Voice Selection -->
			<div class="space-y-2">
				<label class="text-sm font-medium text-foreground">Voice</label>
				<select
					bind:value={voiceId}
					class="w-full px-3 py-2 border border-border bg-white dark:bg-zinc-800 text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
				>
					<option value="">Select a voice...</option>
					<option value="alloy">Alloy</option>
					<option value="echo">Echo</option>
					<option value="fable">Fable</option>
					<option value="onyx">Onyx</option>
					<option value="nova">Nova</option>
					<option value="shimmer">Shimmer</option>
				</select>
			</div>

			<!-- Speed Control -->
			<div class="space-y-2">
				<label class="text-sm font-medium text-foreground">
					Speed: {voiceSpeed}x
				</label>
				<input
					type="range"
					bind:value={voiceSpeed}
					min="0.5"
					max="2"
					step="0.1"
					class="w-full"
				/>
			</div>

			<!-- Action Buttons -->
			<div class="flex gap-2">
				<button
					onclick={handleTestVoice}
					disabled={!voiceId}
					class="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-muted dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-foreground"
				>
					<Volume2 class="w-4 h-4 inline-block mr-2" />
					Test Voice
				</button>
				<button
					onclick={handleResetVoice}
					class="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-muted dark:hover:bg-zinc-800 transition-colors text-foreground"
				>
					Reset to Global
				</button>
			</div>
		</div>
	</div>

	<!-- Project Settings Card -->
	<div class="bg-card border border-border rounded-lg">
		<div class="px-4 py-3 border-b border-border">
			<div class="flex items-center gap-2">
				<Settings2 class="w-5 h-5 text-foreground" />
				<h3 class="font-semibold text-foreground">Project Settings</h3>
			</div>
			<p class="text-sm text-muted-foreground mt-1">
				Configure this agent's models and tools per project
			</p>
		</div>
		<div class="px-4 py-4">
			<div class="text-center py-8 text-muted-foreground">
				<p class="text-sm">No projects found where this agent is assigned</p>
				<p class="text-xs mt-1">Project-specific settings will appear here when the agent is added to a project</p>
			</div>
		</div>
	</div>

	<!-- Save Button -->
	<div class="flex justify-end">
		<button
			onclick={handleSaveSettings}
			disabled={isSaving}
			class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 dark:bg-blue-500 dark:hover:bg-primary rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
		>
			<Save class="w-4 h-4 inline-block mr-2" />
			{isSaving ? 'Saving...' : 'Save Settings'}
		</button>
	</div>
</div>
