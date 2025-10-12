<script lang="ts">
	import type { TTSProvider } from '$lib/stores/aiConfig.svelte';
	import { cn } from '$lib/utils/cn';

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

	// Pre-defined voices
	const openAIVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

	const elevenLabsVoices = [
		'Rachel',
		'Domi',
		'Bella',
		'Antoni',
		'Elli',
		'Josh',
		'Arnold',
		'Adam',
		'Sam'
	];

	let selectedVoices = $state<string[]>(currentVoiceIds || []);
	let customVoiceId = $state('');

	const availableVoices = $derived(provider === 'openai' ? openAIVoices : elevenLabsVoices);

	function handleClose() {
		open = false;
		onOpenChange?.(false);
		selectedVoices = currentVoiceIds || [];
		customVoiceId = '';
	}

	function toggleVoice(voiceId: string) {
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
			class="relative w-full max-w-lg bg-white rounded-lg shadow-xl p-6"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
		>
			<!-- Close Button -->
			<button
				onclick={handleClose}
				class="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
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
			<h2 class="text-xl font-semibold text-gray-900 mb-2">
				{multiSelect ? 'Select Voices' : 'Select Voice'}
			</h2>
			<p class="text-sm text-gray-500 mb-4">
				{#if multiSelect}
					Select multiple voices for deterministic assignment to agents
				{:else}
					Select a single voice for all agents
				{/if}
			</p>

			<!-- Voice Grid -->
			<div class="space-y-4 max-h-96 overflow-y-auto">
				<div>
					<h3 class="text-sm font-medium text-gray-700 mb-2">
						{provider === 'openai' ? 'OpenAI Voices' : 'ElevenLabs Voices'}
					</h3>
					<div class="grid grid-cols-2 gap-2">
						{#each availableVoices as voice (voice)}
							<button
								onclick={() => toggleVoice(voice)}
								class={cn(
									'px-4 py-2 border rounded-md text-sm transition-colors',
									selectedVoices.includes(voice)
										? 'bg-blue-50 border-blue-500 text-blue-700'
										: 'border-gray-300 hover:bg-gray-50'
								)}
							>
								{voice}
							</button>
						{/each}
					</div>
				</div>

				<!-- Selected Voices (for multi-select) -->
				{#if multiSelect && selectedVoices.length > 0}
					<div>
						<h3 class="text-sm font-medium text-gray-700 mb-2">
							Selected ({selectedVoices.length})
						</h3>
						<div class="flex flex-wrap gap-2">
							{#each selectedVoices as voice (voice)}
								<div class="flex items-center gap-1 px-2 py-1 bg-blue-100 rounded text-sm">
									<span>{voice}</span>
									<button
										onclick={() => removeVoice(voice)}
										class="text-blue-600 hover:text-blue-800"
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
						<h3 class="text-sm font-medium text-gray-700 mb-2">Custom Voice ID</h3>
						<div class="flex gap-2">
							<input
								type="text"
								bind:value={customVoiceId}
								placeholder="Enter voice ID"
								class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								onkeydown={(e) => e.key === 'Enter' && addCustomVoice()}
							/>
							<button
								onclick={addCustomVoice}
								class="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
								disabled={!customVoiceId.trim()}
							>
								Add
							</button>
						</div>
						<p class="text-xs text-gray-500 mt-1">
							Get voice IDs from your ElevenLabs dashboard
						</p>
					</div>
				{/if}
			</div>

			<!-- Actions -->
			<div class="flex gap-3 mt-6">
				<button
					onclick={handleClose}
					class="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
				>
					Cancel
				</button>
				<button
					onclick={handleConfirm}
					disabled={selectedVoices.length === 0}
					class={cn(
						'flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors',
						selectedVoices.length === 0 && 'opacity-50 cursor-not-allowed'
					)}
				>
					Confirm Selection
				</button>
			</div>
		</div>
	</div>
{/if}
