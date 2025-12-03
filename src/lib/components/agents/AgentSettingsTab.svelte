<script lang="ts">
	import { Volume2, Settings2, Save } from 'lucide-svelte';
	import { aiConfigStore } from '$lib/stores/aiConfig.svelte';
	import { storage } from '$lib/utils/storage.svelte';

	interface Props {
		pubkey: string;
	}

	let { pubkey }: Props = $props();

	interface AgentVoiceConfig {
		voiceId: string;
		speed?: number;
	}

	// Load voice settings from storage
	function loadVoiceConfig(): AgentVoiceConfig | null {
		const configs = storage.get('agent-voice-configs') ?? {};
		return configs[pubkey] || null;
	}

	// Save voice settings to storage
	function saveVoiceConfig(config: AgentVoiceConfig) {
		const configs = storage.get('agent-voice-configs') ?? {};
		configs[pubkey] = config;
		storage.set('agent-voice-configs', configs);
	}

	// Initialize with saved config or defaults from global settings
	const savedConfig = loadVoiceConfig();
	let voiceId = $state(savedConfig?.voiceId || '');
	let voiceSpeed = $state(savedConfig?.speed || aiConfigStore.config.voiceSettings.speed);

	let isSaving = $state(false);

	// Get available voices from global settings
	const availableVoiceIds = $derived(aiConfigStore.config.voiceSettings.voiceIds);

	async function handleSaveSettings() {
		isSaving = true;
		try {
			// Save voice settings to localStorage
			saveVoiceConfig({
				voiceId,
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

	function handleResetVoice() {
		const configs = storage.get('agent-voice-configs') ?? {};
		delete configs[pubkey];
		storage.set('agent-voice-configs', configs);

		// Reset to defaults
		voiceId = '';
		voiceSpeed = aiConfigStore.config.voiceSettings.speed;

		console.log('[AgentSettingsTab] Voice settings reset to global defaults');
	}
</script>

<div class="space-y-6">
	<!-- Voice Settings Card -->
	<div class="bg-card border border-border rounded-lg">
		<div class="px-4 py-3 border-b border-border">
			<div class="flex items-center gap-2">
				<Volume2 class="w-5 h-5 text-foreground" />
				<h3 class="font-semibold text-foreground">Voice Settings</h3>
				{#if voiceId}
					<span class="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded">
						Custom
					</span>
				{/if}
			</div>
			<p class="text-sm text-muted-foreground mt-1">
				Configure the voice for this agent
			</p>
		</div>
		<div class="px-4 py-4 space-y-4">
			<!-- Voice Selection -->
			<div class="space-y-2">
				<label class="text-sm font-medium text-foreground">Voice</label>
				<p class="text-xs text-muted-foreground">
					Select from pre-configured voices in AI settings
				</p>
				<select
					bind:value={voiceId}
					class="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
				>
					<option value="">Use global default</option>
					{#each availableVoiceIds as voice (voice)}
						<option value={voice}>
							{voice}
						</option>
					{/each}
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
					onclick={handleResetVoice}
					class="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-muted transition-colors text-foreground"
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
			class="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
		>
			<Save class="w-4 h-4 inline-block mr-2" />
			{isSaving ? 'Saving...' : 'Save Settings'}
		</button>
	</div>
</div>
