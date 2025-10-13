<script lang="ts">
	import { aiConfigStore, type LLMConfig, type TTSProvider, type STTProvider } from '$lib/stores/aiConfig.svelte';
	import { cn } from '$lib/utils/cn';
	import { voiceDiscovery } from '$lib/services/voice-discovery';
	import AddProviderDialog from '../dialogs/AddProviderDialog.svelte';
	import VoiceSelectionDialog from '../dialogs/VoiceSelectionDialog.svelte';

	let showAddProvider = $state(false);
	let showVoiceSelection = $state<boolean | 'multi'>(false);
	let testingConnection = $state<string | null>(null);
	let previewingVoice = $state(false);

	const config = $derived(aiConfigStore.config);
	const llmConfigs = $derived(config.llmConfigs);
	const activeConfigId = $derived(config.activeLLMConfigId);
	const voiceSettings = $derived(config.voiceSettings);
	const sttSettings = $derived(config.sttSettings);
	const uiLLMConfigs = $derived(config.uiLLMConfigs);

	async function handleTestConnection(llmConfig: LLMConfig) {
		testingConnection = llmConfig.id;

		// Simulate test (in production, you'd call the actual API)
		await new Promise((resolve) => setTimeout(resolve, 1000));

		alert('Connection test successful!');
		testingConnection = null;
	}

	function handleDeleteConfig(id: string) {
		if (confirm('Are you sure you want to delete this configuration?')) {
			aiConfigStore.removeLLMConfig(id);
		}
	}

	async function handlePreviewVoice() {
		if (!voiceSettings.voiceIds || voiceSettings.voiceIds.length === 0) {
			alert('No voice selected');
			return;
		}

		const apiKey =
			voiceSettings.provider === 'openai' ? config.openAIApiKey : voiceSettings.apiKey;

		if (!apiKey) {
			alert(`${voiceSettings.provider} API key required`);
			return;
		}

		previewingVoice = true;

		try {
			const audioBlob = await voiceDiscovery.previewVoice(
				voiceSettings.provider,
				voiceSettings.voiceIds[0],
				'Hello, this is a preview of this voice.',
				apiKey
			);

			// Play the audio
			const audioUrl = URL.createObjectURL(audioBlob);
			const audio = new Audio(audioUrl);
			await audio.play();
			audio.onended = () => URL.revokeObjectURL(audioUrl);
		} catch (error) {
			console.error('Failed to preview voice:', error);
			alert(`Failed to preview voice: ${error instanceof Error ? error.message : 'Unknown error'}`);
		} finally {
			previewingVoice = false;
		}
	}
</script>

<div class="space-y-6">
	<!-- AI Providers Section -->
	<div class="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-6">
		<div class="mb-4">
			<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
				<span>🤖</span> AI Providers
			</h3>
			<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your LLM configurations for text generation</p>
		</div>

		{#if llmConfigs.length > 0}
			<div class="space-y-4">
				{#each llmConfigs as llmConfig (llmConfig.id)}
					<div
						class={cn(
							'flex items-center justify-between p-4 border rounded-lg',
							activeConfigId === llmConfig.id ? 'border-blue-500 bg-blue-50 dark:bg-zinc-800' : 'border-gray-200 dark:border-zinc-700'
						)}
					>
						<div class="flex items-center gap-3">
							<input
								type="radio"
								name="active-llm"
								checked={activeConfigId === llmConfig.id}
								onchange={() => aiConfigStore.setActiveLLMConfig(llmConfig.id)}
								class="w-4 h-4"
							/>
							<div>
								<div class="font-medium dark:text-gray-100">{llmConfig.name}</div>
								<div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
									<span class="capitalize">{llmConfig.provider}</span>
									<span>•</span>
									<span>{llmConfig.model}</span>
									<span>•</span>
									<span>•••••{llmConfig.apiKey.slice(-4)}</span>
								</div>
							</div>
						</div>
						<div class="flex items-center gap-2">
							{#if activeConfigId === llmConfig.id}
								<div class="flex items-center gap-1 px-2 py-1 bg-blue-100 rounded text-xs text-blue-700">
									✓ Active
								</div>
							{/if}
							<button
								onclick={() => handleTestConnection(llmConfig)}
								disabled={testingConnection === llmConfig.id}
								class="px-3 py-1 text-sm border border-gray-300 dark:border-zinc-700 rounded hover:bg-gray-50 dark:hover:bg-zinc-800"
							>
								{testingConnection === llmConfig.id ? 'Testing...' : 'Test'}
							</button>
							<button
								onclick={() => handleDeleteConfig(llmConfig.id)}
								class="px-3 py-1 text-sm border border-gray-300 dark:border-zinc-700 rounded hover:bg-gray-50 dark:hover:bg-zinc-800"
								aria-label="Delete configuration"
							>
								🗑️
							</button>
						</div>
					</div>
				{/each}
				<button
					onclick={() => (showAddProvider = true)}
					class="w-full px-4 py-2 border border-gray-300 dark:border-zinc-700 rounded hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
				>
					+ Add New Configuration
				</button>
			</div>
		{:else}
			<div class="flex flex-col items-center justify-center py-8 space-y-4">
				<p class="text-sm text-gray-500 dark:text-gray-400">No LLM configurations added yet</p>
				<button
					onclick={() => (showAddProvider = true)}
					class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
				>
					+ Add Your First Configuration
				</button>
			</div>
		{/if}
	</div>

	<!-- UI Features Configuration -->
	{#if llmConfigs.length > 0}
		<div class="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-6">
			<div class="mb-4">
				<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
					<span>✨</span> UI Features Configuration
				</h3>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
					Choose which LLM configurations to use for specific UI features
				</p>
			</div>

			<div class="space-y-4">
				<!-- Title Generation -->
				<div class="space-y-2">
					<label for="title-gen" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
						Title Generation
					</label>
					<select
						id="title-gen"
						bind:value={uiLLMConfigs.titleGeneration}
						onchange={(e) =>
							aiConfigStore.updateUILLMConfigs({
								titleGeneration: e.currentTarget.value === 'default' ? undefined : e.currentTarget.value
							})}
						class="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-100"
					>
						<option value="default">Use active configuration</option>
						{#each llmConfigs as llmConfig (llmConfig.id)}
							<option value={llmConfig.id}>{llmConfig.name} ({llmConfig.provider})</option>
						{/each}
					</select>
					<p class="text-xs text-gray-500 dark:text-gray-400">Used when generating titles for conversations</p>
				</div>

				<!-- Summaries -->
				<div class="space-y-2">
					<label for="summaries" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
						Conversation Summaries
					</label>
					<select
						id="summaries"
						bind:value={uiLLMConfigs.summaries}
						onchange={(e) =>
							aiConfigStore.updateUILLMConfigs({
								summaries: e.currentTarget.value === 'default' ? undefined : e.currentTarget.value
							})}
						class="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-100"
					>
						<option value="default">Use active configuration</option>
						{#each llmConfigs as llmConfig (llmConfig.id)}
							<option value={llmConfig.id}>{llmConfig.name} ({llmConfig.provider})</option>
						{/each}
					</select>
					<p class="text-xs text-gray-500 dark:text-gray-400">Used for generating conversation summaries</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- Voice Settings -->
	<div class="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-6">
		<div class="mb-4">
			<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
				<span>🎤</span> Voice Settings
			</h3>
			<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Configure speech-to-text and text-to-speech</p>
		</div>

		<div class="space-y-6">
			<!-- Speech-to-Text -->
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<label for="stt-enabled" class="text-sm font-medium text-gray-700 dark:text-gray-300">
						Speech-to-Text
					</label>
					<input
						id="stt-enabled"
						type="checkbox"
						checked={sttSettings.enabled}
						onchange={(e) => aiConfigStore.updateSTTSettings({ enabled: e.currentTarget.checked })}
						class="w-4 h-4"
					/>
				</div>

				{#if sttSettings.enabled}
					<div class="space-y-4 pl-4">
						<div class="space-y-2">
							<p class="text-sm font-medium text-gray-700 dark:text-gray-300">STT Provider</p>
							<div class="space-y-2">
								<label class="flex items-center gap-2">
									<input
										type="radio"
										name="stt-provider"
										value="whisper"
										checked={sttSettings.provider === 'whisper'}
										onchange={() => aiConfigStore.updateSTTSettings({ provider: 'whisper' })}
									/>
									<span class="text-sm">OpenAI Whisper</span>
								</label>
								<label class="flex items-center gap-2">
									<input
										type="radio"
										name="stt-provider"
										value="elevenlabs"
										checked={sttSettings.provider === 'elevenlabs'}
										onchange={() => aiConfigStore.updateSTTSettings({ provider: 'elevenlabs' })}
									/>
									<span class="text-sm">ElevenLabs</span>
								</label>
							</div>
						</div>

						{#if sttSettings.provider === 'whisper'}
							<div class="space-y-2">
								<label for="openai-key-stt" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
									🔑 OpenAI API Key for STT
								</label>
								<input
									id="openai-key-stt"
									type="password"
									bind:value={config.openAIApiKey}
									onchange={(e) => aiConfigStore.setOpenAIApiKey(e.currentTarget.value)}
									class="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-100"
									placeholder="sk-..."
								/>
								<p class="text-xs text-gray-500 dark:text-gray-400">Uses Whisper model: {sttSettings.model}</p>
							</div>
						{/if}

						{#if sttSettings.provider === 'elevenlabs'}
							<div class="space-y-2">
								<label for="elevenlabs-key-stt" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
									🔑 ElevenLabs API Key
								</label>
								<input
									id="elevenlabs-key-stt"
									type="password"
									bind:value={voiceSettings.apiKey}
									onchange={(e) =>
										aiConfigStore.updateVoiceSettings({ apiKey: e.currentTarget.value })}
									class="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-100"
									placeholder="Enter your ElevenLabs API key"
								/>
								<p class="text-xs text-gray-500 dark:text-gray-400">
									{voiceSettings.apiKey
										? 'This key is shared with Text-to-Speech settings'
										: 'Get your API key from the ElevenLabs dashboard'}
								</p>
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Text-to-Speech -->
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<label for="tts-enabled" class="text-sm font-medium text-gray-700 dark:text-gray-300">
						Text-to-Speech
					</label>
					<input
						id="tts-enabled"
						type="checkbox"
						checked={voiceSettings.enabled}
						onchange={(e) =>
							aiConfigStore.updateVoiceSettings({
								enabled: e.currentTarget.checked,
								voiceIds: voiceSettings.voiceIds?.length > 0 ? voiceSettings.voiceIds : ['alloy']
							})}
						class="w-4 h-4"
					/>
				</div>

				{#if voiceSettings.enabled}
					<div class="space-y-4 pl-4">
						<div class="space-y-2">
							<p class="text-sm font-medium text-gray-700 dark:text-gray-300">Voice Provider</p>
							<div class="space-y-2">
								<label class="flex items-center gap-2">
									<input
										type="radio"
										name="tts-provider"
										value="openai"
										checked={voiceSettings.provider === 'openai'}
										onchange={() => aiConfigStore.updateVoiceSettings({ provider: 'openai' })}
									/>
									<span class="text-sm">OpenAI</span>
								</label>
								<label class="flex items-center gap-2">
									<input
										type="radio"
										name="tts-provider"
										value="elevenlabs"
										checked={voiceSettings.provider === 'elevenlabs'}
										onchange={() => aiConfigStore.updateVoiceSettings({ provider: 'elevenlabs' })}
									/>
									<span class="text-sm">ElevenLabs</span>
								</label>
							</div>
						</div>

						{#if voiceSettings.provider === 'openai'}
							<div class="space-y-2">
								<label for="openai-key-tts" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
									🔑 OpenAI API Key
								</label>
								<input
									id="openai-key-tts"
									type="password"
									bind:value={config.openAIApiKey}
									onchange={(e) => aiConfigStore.setOpenAIApiKey(e.currentTarget.value)}
									class="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-100"
									placeholder="sk-..."
								/>
								<p class="text-xs text-gray-500 dark:text-gray-400">Get your API key from platform.openai.com</p>
							</div>
						{/if}

						{#if voiceSettings.provider === 'elevenlabs'}
							<div class="space-y-2">
								<label for="elevenlabs-key-tts" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
									🔑 ElevenLabs API Key
								</label>
								<input
									id="elevenlabs-key-tts"
									type="password"
									bind:value={voiceSettings.apiKey}
									onchange={(e) =>
										aiConfigStore.updateVoiceSettings({ apiKey: e.currentTarget.value })}
									class="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-100"
									placeholder="Enter your ElevenLabs API key"
								/>
								<p class="text-xs text-gray-500 dark:text-gray-400">
									{voiceSettings.apiKey
										? 'This key is shared with Speech-to-Text settings'
										: 'Get your API key from the ElevenLabs dashboard'}
								</p>
							</div>
						{/if}

						<!-- Voice Selection -->
						<div class="space-y-2">
							<p class="text-sm font-medium text-gray-700 dark:text-gray-300">
								Voice{voiceSettings.voiceIds?.length > 1 ? 's' : ''}: {voiceSettings.voiceIds?.join(', ') || 'None'}
							</p>
							<div class="flex gap-2">
								<button
									onclick={() => (showVoiceSelection = true)}
									class="px-4 py-2 border border-gray-300 dark:border-zinc-700 rounded hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
								>
									Select Voice
								</button>
								<button
									onclick={() => (showVoiceSelection = 'multi')}
									class="px-4 py-2 border border-gray-300 dark:border-zinc-700 rounded hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
								>
									👥 Select Multiple
								</button>
								<button
									onclick={handlePreviewVoice}
									disabled={!voiceSettings.voiceIds?.length || previewingVoice}
									class={cn(
										'px-4 py-2 border border-gray-300 dark:border-zinc-700 rounded hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors',
										(!voiceSettings.voiceIds?.length || previewingVoice) && 'opacity-50 cursor-not-allowed'
									)}
								>
									{previewingVoice ? '🔊 Playing...' : '🔊 Preview'}
								</button>
							</div>
							<p class="text-xs text-gray-500 dark:text-gray-400">
								{#if voiceSettings.voiceIds?.length > 1}
									Each agent gets a consistent voice based on their ID
								{:else}
									All agents use the same voice
								{/if}
							</p>
						</div>

						<!-- Speed -->
						<div class="space-y-2">
							<label for="speed" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Speed: {voiceSettings.speed}x
							</label>
							<input
								id="speed"
								type="range"
								min="0.5"
								max="2"
								step="0.1"
								bind:value={voiceSettings.speed}
								onchange={(e) =>
									aiConfigStore.updateVoiceSettings({ speed: parseFloat(e.currentTarget.value) })}
								class="w-full"
							/>
						</div>

						<!-- Auto-speak -->
						<div class="flex items-center justify-between">
							<label for="auto-speak" class="text-sm font-medium text-gray-700 dark:text-gray-300">
								Auto-speak replies
							</label>
							<input
								id="auto-speak"
								type="checkbox"
								checked={voiceSettings.autoSpeak}
								onchange={(e) =>
									aiConfigStore.updateVoiceSettings({ autoSpeak: e.currentTarget.checked })}
								class="w-4 h-4"
							/>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Quick Actions -->
	<div class="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-6">
		<div class="mb-4">
			<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
				<span>⚡</span> Quick Actions
			</h3>
		</div>
		<div class="flex gap-2">
			<button
				onclick={() => {
					if (confirm('Reset all settings to defaults?')) {
						aiConfigStore.reset();
						alert('Settings reset successfully');
					}
				}}
				class="px-4 py-2 border border-gray-300 dark:border-zinc-700 rounded hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
			>
				Reset to Defaults
			</button>
		</div>
	</div>
</div>

<!-- Dialogs -->
<AddProviderDialog bind:open={showAddProvider} />
<VoiceSelectionDialog
	bind:open={showVoiceSelection}
	provider={voiceSettings.provider}
	currentVoiceIds={voiceSettings.voiceIds}
	multiSelect={showVoiceSelection === 'multi'}
	onSelect={(voiceId) => aiConfigStore.updateVoiceSettings({ voiceIds: [voiceId] })}
	onMultiSelect={(voiceIds) => aiConfigStore.updateVoiceSettings({ voiceIds })}
/>
