<script lang="ts">
	import type { TTSProvider } from '$lib/stores/aiConfig.svelte';
	import { aiConfigStore } from '$lib/stores/aiConfig.svelte';
	import { cn } from '$lib/utils/cn';
	import { voiceDiscovery, type Voice } from '$lib/services/voice-discovery';

	interface Props {
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		provider: TTSProvider;
		currentVoiceIds?: string[];
		multiSelect?: boolean;
		onSelect?: (voiceId: string) => void;
		onMultiSelect?: (voiceIds: string[]) => void;
	}

	let {
		open = $bindable(false),
		onOpenChange,
		provider,
		currentVoiceIds = [],
		multiSelect = false,
		onSelect,
		onMultiSelect
	}: Props = $props();

	let selectedVoices = $state<string[]>(currentVoiceIds || []);
	let customVoiceId = $state('');
	let availableVoices = $state<Voice[]>([]);
	let fetchingVoices = $state(false);
	let fetchError = $state('');
	let previewingVoiceId = $state<string | null>(null);

	// Fetch voices when dialog opens or provider changes
	$effect(() => {
		if (open) {
			handleFetchVoices();
		}
	});

	async function handleFetchVoices() {
		fetchingVoices = true;
		fetchError = '';

		try {
			const apiKey =
				provider === 'openai'
					? aiConfigStore.config.openAIApiKey
					: aiConfigStore.config.voiceSettings.apiKey;

			if (!apiKey && provider === 'elevenlabs') {
				fetchError = 'Please set your ElevenLabs API key in settings first';
				availableVoices = [];
				return;
			}

			const voices = await voiceDiscovery.fetchVoices(provider, apiKey);
			availableVoices = voices;
		} catch (error) {
			console.error('Failed to fetch voices:', error);
			fetchError = error instanceof Error ? error.message : 'Failed to fetch voices';
			availableVoices = [];
		} finally {
			fetchingVoices = false;
		}
	}

	async function handlePreviewVoice(voiceId: string) {
		previewingVoiceId = voiceId;

		try {
			const apiKey =
				provider === 'openai'
					? aiConfigStore.config.openAIApiKey
					: aiConfigStore.config.voiceSettings.apiKey;

			const audioBlob = await voiceDiscovery.previewVoice(provider, voiceId, 'Hello, this is a preview of this voice.', apiKey);

			// Play the audio
			const audioUrl = URL.createObjectURL(audioBlob);
			const audio = new Audio(audioUrl);
			await audio.play();
			audio.onended = () => URL.revokeObjectURL(audioUrl);
		} catch (error) {
			console.error('Failed to preview voice:', error);
			alert(`Failed to preview voice: ${error instanceof Error ? error.message : 'Unknown error'}`);
		} finally {
			previewingVoiceId = null;
		}
	}

	function handleClose() {
		open = false;
		onOpenChange?.(false);
		selectedVoices = currentVoiceIds || [];
		customVoiceId = '';
	}

	function toggleVoice(voiceId: string, event?: Event) {
		// Prevent toggle when clicking preview button
		if (event && (event.target as HTMLElement).closest('.preview-button')) {
			return;
		}

		if (multiSelect) {
			if (selectedVoices.includes(voiceId)) {
				selectedVoices = selectedVoices.filter((v) => v !== voiceId);
			} else {
				selectedVoices = [...selectedVoices, voiceId];
			}
		} else {
			selectedVoices = [voiceId];
		}
	}

	function addCustomVoice() {
		if (!customVoiceId.trim()) return;

		if (!selectedVoices.includes(customVoiceId.trim())) {
			selectedVoices = [...selectedVoices, customVoiceId.trim()];
		}
		customVoiceId = '';
	}

	function removeVoice(voiceId: string) {
		selectedVoices = selectedVoices.filter((v) => v !== voiceId);
	}

	function handleConfirm() {
		if (selectedVoices.length === 0) {
			alert('Please select at least one voice');
			return;
		}

		if (multiSelect) {
			onMultiSelect?.(selectedVoices);
		} else {
			onSelect?.(selectedVoices[0]);
		}

		handleClose();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			handleClose();
		}
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
		onclick={handleClose}
		onkeydown={handleKeydown}
		role="presentation"
		tabindex="0"
	>
		<div
			class="relative w-full max-w-lg bg-card rounded-lg shadow-xl p-6"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
		>
			<!-- Close Button -->
			<button
				onclick={handleClose}
				class="absolute top-4 right-4 text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground"
				aria-label="Close dialog"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					/>
				</svg>
			</button>

			<!-- Header -->
			<h2 class="text-xl font-semibold text-foreground mb-2">
				{multiSelect ? 'Select Voices' : 'Select Voice'}
			</h2>
			<p class="text-sm text-muted-foreground mb-4">
				{#if multiSelect}
					Select multiple voices for deterministic assignment to agents
				{:else}
					Select a single voice for all agents
				{/if}
			</p>

			<!-- Voice Grid -->
			<div class="space-y-4 max-h-96 overflow-y-auto">
				{#if fetchingVoices}
					<div class="flex items-center justify-center py-8">
						<div class="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
						<span class="ml-2 text-muted-foreground">Loading voices...</span>
					</div>
				{:else if fetchError}
					<div class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
						<p class="text-sm text-red-800 dark:text-red-300">{fetchError}</p>
					</div>
				{:else if availableVoices.length > 0}
					<div>
						<h3 class="text-sm font-medium text-foreground mb-2">
							{provider === 'openai' ? 'OpenAI Voices' : 'ElevenLabs Voices'}
						</h3>
						<div class="grid grid-cols-1 gap-2">
							{#each availableVoices as voice (voice.id)}
								<div
									role="button"
									tabindex="0"
									onclick={(e) => toggleVoice(voice.id, e)}
									onkeydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											toggleVoice(voice.id, e);
										}
									}}
									class={cn(
										'px-4 py-3 border rounded-md text-left transition-colors relative cursor-pointer',
										selectedVoices.includes(voice.id)
											? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 dark:border-blue-400'
											: 'border-border hover:bg-muted dark:hover:bg-zinc-800/50'
									)}
								>
									<div class="flex items-center justify-between">
										<div class="flex-1">
											<div class="font-medium text-sm text-foreground">{voice.name}</div>
											{#if voice.description}
												<div class="text-xs text-muted-foreground mt-1">{voice.description}</div>
											{/if}
											{#if voice.labels}
												<div class="flex flex-wrap gap-1 mt-1">
													{#each Object.entries(voice.labels) as [, value]}
														<span class="text-xs px-1.5 py-0.5 bg-muted text-foreground rounded">
															{value}
														</span>
													{/each}
												</div>
											{/if}
										</div>
										<button
											type="button"
											onclick={(e) => {
												e.stopPropagation();
												handlePreviewVoice(voice.id);
											}}
											disabled={previewingVoiceId === voice.id}
											class="preview-button ml-2 px-3 py-1 text-xs border border-border rounded hover:bg-muted text-foreground transition-colors disabled:opacity-50"
										>
											{previewingVoiceId === voice.id ? '🔊 Playing...' : '🔊 Preview'}
										</button>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{:else}
					<div class="text-center py-8 text-muted-foreground">
						<p>No voices available</p>
					</div>
				{/if}

				<!-- Selected Voices (for multi-select) -->
				{#if multiSelect && selectedVoices.length > 0}
					<div>
						<h3 class="text-sm font-medium text-foreground mb-2">
							Selected ({selectedVoices.length})
						</h3>
						<div class="flex flex-wrap gap-2">
							{#each selectedVoices as voice (voice)}
								<div class="flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-sm">
									<span>{voice}</span>
									<button
										onclick={() => removeVoice(voice)}
										class="text-primary dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
										aria-label="Remove voice"
									>
										×
									</button>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Custom Voice ID (for ElevenLabs) -->
				{#if provider === 'elevenlabs'}
					<div>
						<h3 class="text-sm font-medium text-foreground mb-2">Custom Voice ID</h3>
						<div class="flex gap-2">
							<input
								type="text"
								bind:value={customVoiceId}
								placeholder="Enter voice ID"
								class="flex-1 px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
								onkeydown={(e) => e.key === 'Enter' && addCustomVoice()}
							/>
							<button
								onclick={addCustomVoice}
								class="px-4 py-2 bg-muted hover:bg-accent text-foreground rounded-md transition-colors"
								disabled={!customVoiceId.trim()}
							>
								Add
							</button>
						</div>
						<p class="text-xs text-muted-foreground mt-1">
							Get voice IDs from your ElevenLabs dashboard
						</p>
					</div>
				{/if}
			</div>

			<!-- Actions -->
			<div class="flex gap-3 mt-6">
				<button
					onclick={handleClose}
					class="flex-1 px-4 py-2 border border-border rounded-md hover:bg-muted dark:hover:bg-zinc-800 text-foreground transition-colors"
				>
					Cancel
				</button>
				<button
					onclick={handleConfirm}
					disabled={selectedVoices.length === 0}
					class={cn(
						'flex-1 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors',
						selectedVoices.length === 0 && 'opacity-50 cursor-not-allowed'
					)}
				>
					Confirm Selection
				</button>
			</div>
		</div>
	</div>
{/if}
