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

	// Filtering states
	let searchQuery = $state('');
	let selectedGender = $state<string | null>(null);
	let selectedAccent = $state<string | null>(null);
	let selectedAge = $state<string | null>(null);
	let selectedUseCase = $state<string | null>(null);

	// Get unique filter values from available voices
	const genderOptions = $derived(() => {
		const genders = new Set<string>();
		availableVoices.forEach(voice => {
			if (voice.labels?.gender) genders.add(voice.labels.gender);
		});
		return Array.from(genders).sort();
	});

	const accentOptions = $derived(() => {
		const accents = new Set<string>();
		availableVoices.forEach(voice => {
			if (voice.labels?.accent) accents.add(voice.labels.accent);
		});
		return Array.from(accents).sort();
	});

	const ageOptions = $derived(() => {
		const ages = new Set<string>();
		availableVoices.forEach(voice => {
			if (voice.labels?.age) ages.add(voice.labels.age);
		});
		return Array.from(ages).sort();
	});

	const useCaseOptions = $derived(() => {
		const useCases = new Set<string>();
		availableVoices.forEach(voice => {
			if (voice.labels?.useCase) useCases.add(voice.labels.useCase);
		});
		return Array.from(useCases).sort();
	});

	// Filter voices based on search and filters
	const filteredVoices = $derived(() => {
		return availableVoices.filter(voice => {
			// Search filter
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				const matchesSearch =
					voice.name.toLowerCase().includes(query) ||
					voice.description?.toLowerCase().includes(query) ||
					Object.values(voice.labels || {}).some(label =>
						label?.toLowerCase().includes(query)
					);
				if (!matchesSearch) return false;
			}

			// Gender filter
			if (selectedGender && voice.labels?.gender !== selectedGender) return false;

			// Accent filter
			if (selectedAccent && voice.labels?.accent !== selectedAccent) return false;

			// Age filter
			if (selectedAge && voice.labels?.age !== selectedAge) return false;

			// Use case filter
			if (selectedUseCase && voice.labels?.useCase !== selectedUseCase) return false;

			return true;
		});
	});

	function clearFilters() {
		searchQuery = '';
		selectedGender = null;
		selectedAccent = null;
		selectedAge = null;
		selectedUseCase = null;
	}

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

			const voice = availableVoices.find(v => v.id === voiceId);
			const previewText = voice
				? `Hi, I'm ${voice.name}${voice.description ? ` -- the ${voice.description}` : ''}`
				: 'Hello, this is a preview of this voice.';

			const audioBlob = await voiceDiscovery.previewVoice(provider, voiceId, previewText, apiKey);

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
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
		onclick={handleClose}
		onkeydown={handleKeydown}
		role="presentation"
		tabindex="0"
	>
		<div
			class="relative w-full max-w-4xl bg-card rounded-xl shadow-2xl border border-border/50 overflow-hidden"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
		>
			<!-- Header Section -->
			<div class="bg-gradient-to-r from-blue-600/10 to-purple-600/10 border-b border-border/50 px-6 py-5">
				<button
					onclick={handleClose}
					class="absolute top-5 right-5 text-muted-foreground hover:text-foreground transition-colors"
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

				<h2 class="text-2xl font-bold text-foreground mb-1">
					{multiSelect ? 'Select Voices' : 'Select Voice'}
				</h2>
				<p class="text-sm text-muted-foreground">
					{#if multiSelect}
						Select multiple voices for deterministic assignment to agents
					{:else}
						Choose a voice for your AI assistant
					{/if}
				</p>
			</div>

			<!-- Search and Filters Section -->
			<div class="px-6 py-4 bg-muted/30 border-b border-border/50">
				<!-- Search Bar -->
				<div class="relative mb-3">
					<svg
						class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
						/>
					</svg>
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Search voices..."
						class="w-full pl-10 pr-4 py-2.5 border border-border/50 rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
					/>
				</div>

				<!-- Filter Pills -->
				<div class="space-y-2">
					{#if genderOptions().length > 0}
						<div class="flex items-center gap-2 flex-wrap">
							<span class="text-xs font-medium text-muted-foreground min-w-[60px]">Gender:</span>
							<div class="flex gap-1.5 flex-wrap">
								{#each genderOptions() as gender}
									<button
										onclick={() => selectedGender = selectedGender === gender ? null : gender}
										class={cn(
											'px-3 py-1 text-xs rounded-full border transition-all capitalize',
											selectedGender === gender
												? 'bg-primary text-primary-foreground border-primary'
												: 'bg-background border-border hover:bg-muted text-foreground'
										)}
									>
										{gender}
									</button>
								{/each}
							</div>
						</div>
					{/if}

					{#if accentOptions().length > 0}
						<div class="flex items-center gap-2 flex-wrap">
							<span class="text-xs font-medium text-muted-foreground min-w-[60px]">Accent:</span>
							<div class="flex gap-1.5 flex-wrap">
								{#each accentOptions() as accent}
									<button
										onclick={() => selectedAccent = selectedAccent === accent ? null : accent}
										class={cn(
											'px-3 py-1 text-xs rounded-full border transition-all capitalize',
											selectedAccent === accent
												? 'bg-primary text-primary-foreground border-primary'
												: 'bg-background border-border hover:bg-muted text-foreground'
										)}
									>
										{accent}
									</button>
								{/each}
							</div>
						</div>
					{/if}

					{#if ageOptions().length > 0}
						<div class="flex items-center gap-2 flex-wrap">
							<span class="text-xs font-medium text-muted-foreground min-w-[60px]">Age:</span>
							<div class="flex gap-1.5 flex-wrap">
								{#each ageOptions() as age}
									<button
										onclick={() => selectedAge = selectedAge === age ? null : age}
										class={cn(
											'px-3 py-1 text-xs rounded-full border transition-all capitalize',
											selectedAge === age
												? 'bg-primary text-primary-foreground border-primary'
												: 'bg-background border-border hover:bg-muted text-foreground'
										)}
									>
										{age}
									</button>
								{/each}
							</div>
						</div>
					{/if}

					{#if useCaseOptions().length > 0}
						<div class="flex items-center gap-2 flex-wrap">
							<span class="text-xs font-medium text-muted-foreground min-w-[60px]">Use Case:</span>
							<div class="flex gap-1.5 flex-wrap">
								{#each useCaseOptions() as useCase}
									<button
										onclick={() => selectedUseCase = selectedUseCase === useCase ? null : useCase}
										class={cn(
											'px-3 py-1 text-xs rounded-full border transition-all',
											selectedUseCase === useCase
												? 'bg-primary text-primary-foreground border-primary'
												: 'bg-background border-border hover:bg-muted text-foreground'
										)}
									>
										{useCase.replace(/_/g, ' ')}
									</button>
								{/each}
							</div>
						</div>
					{/if}

					{#if searchQuery || selectedGender || selectedAccent || selectedAge || selectedUseCase}
						<div class="flex justify-end">
							<button
								onclick={clearFilters}
								class="px-3 py-1 text-xs rounded-full bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-all"
							>
								Clear All Filters
							</button>
						</div>
					{/if}
				</div>
			</div>

			<!-- Content Section -->
			<div class="px-6 py-4 max-h-[400px] overflow-y-auto">
				{#if fetchingVoices}
					<div class="flex items-center justify-center py-12">
						<div class="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
						<span class="ml-3 text-muted-foreground">Loading voices...</span>
					</div>
				{:else if fetchError}
					<div class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
						<p class="text-sm text-red-800 dark:text-red-300">{fetchError}</p>
					</div>
				{:else if filteredVoices().length > 0}
					<div>
						<div class="flex items-center justify-between mb-3">
							<h3 class="text-sm font-medium text-muted-foreground">
								{provider === 'openai' ? 'OpenAI Voices' : 'ElevenLabs Voices'}
							</h3>
							<span class="text-xs text-muted-foreground">
								{filteredVoices().length} {filteredVoices().length === 1 ? 'voice' : 'voices'} found
							</span>
						</div>
						<div class="grid grid-cols-2 gap-3">
							{#each filteredVoices() as voice (voice.id)}
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
										'group relative p-4 border rounded-lg transition-all cursor-pointer hover:shadow-md',
										selectedVoices.includes(voice.id)
											? 'bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500 dark:border-blue-400 ring-2 ring-blue-500/20'
											: 'bg-card border-border hover:border-blue-300 dark:hover:border-blue-700 hover:bg-gradient-to-br hover:from-gray-50/50 hover:to-gray-100/50 dark:hover:from-zinc-800/50 dark:hover:to-zinc-700/50'
									)}
								>
									<!-- Selection Indicator -->
									{#if selectedVoices.includes(voice.id)}
										<div class="absolute -top-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
											<svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
											</svg>
										</div>
									{/if}

									<div class="flex items-start gap-3">
										<div class="flex-1 min-w-0">
											<div class="font-semibold text-foreground text-base">{voice.name}</div>
											{#if voice.description}
												<div class="text-xs text-muted-foreground mt-0.5 line-clamp-2">{voice.description}</div>
											{/if}

											{#if voice.labels}
												<div class="flex flex-wrap gap-1 mt-2">
													{#each Object.entries(voice.labels) as [key, value]}
														<span class={cn(
															'text-[10px] px-2 py-0.5 rounded-full font-medium',
															key === 'gender' && 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
															key === 'accent' && 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
															key === 'age' && 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
															key === 'useCase' && 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
															!['gender', 'accent', 'age', 'useCase'].includes(key) && 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
														)}>
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
											class="preview-button flex-shrink-0 w-10 h-10 rounded-full border border-border bg-background hover:bg-muted transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
											title="Preview voice"
										>
											{#if previewingVoiceId === voice.id}
												<div class="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full"></div>
											{:else}
												<svg class="w-4 h-4 text-foreground" fill="currentColor" viewBox="0 0 20 20">
													<path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
												</svg>
											{/if}
										</button>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{:else}
					<div class="text-center py-12">
						<svg class="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<p class="text-muted-foreground">No voices match your filters</p>
						<button
							onclick={clearFilters}
							class="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
						>
							Clear filters
						</button>
					</div>
				{/if}

				<!-- Selected Voices (for multi-select) -->
				{#if multiSelect && selectedVoices.length > 0}
					<div class="mt-4 p-4 bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-900/10 dark:to-purple-900/10 rounded-lg border border-blue-200/50 dark:border-blue-800/50">
						<h3 class="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
							<svg class="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
							</svg>
							Selected Voices ({selectedVoices.length})
						</h3>
						<div class="flex flex-wrap gap-2">
							{#each selectedVoices as voiceId (voiceId)}
								{@const voice = availableVoices.find(v => v.id === voiceId)}
								<div class="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-zinc-800 border border-blue-300 dark:border-blue-700 rounded-full">
									<span class="text-sm font-medium text-foreground">{voice?.name || voiceId}</span>
									<button
										onclick={() => removeVoice(voiceId)}
										class="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
										aria-label="Remove voice"
									>
										<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
										</svg>
									</button>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Custom Voice ID (for ElevenLabs) -->
				{#if provider === 'elevenlabs'}
					<div class="mt-4 p-4 bg-muted/30 rounded-lg border border-border/50">
						<h3 class="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
							<svg class="w-4 h-4 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
							</svg>
							Custom Voice ID
						</h3>
						<div class="flex gap-2">
							<div class="relative flex-1">
								<input
									type="text"
									bind:value={customVoiceId}
									placeholder="Enter custom voice ID..."
									class="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
									onkeydown={(e) => e.key === 'Enter' && addCustomVoice()}
								/>
							</div>
							<button
								onclick={addCustomVoice}
								class="px-4 py-2 bg-primary text-primary-foreground rounded-lg transition-colors flex items-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90"
								disabled={!customVoiceId.trim()}
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
								</svg>
								Add
							</button>
						</div>
						<p class="text-xs text-muted-foreground mt-2 flex items-center gap-1">
							<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
							</svg>
							Get voice IDs from your ElevenLabs dashboard
						</p>
					</div>
				{/if}
			</div>

			<!-- Footer Actions -->
			<div class="border-t border-border/50 px-6 py-4 bg-muted/20">
				<div class="flex gap-3">
					<button
						onclick={handleClose}
						class="flex-1 px-4 py-2.5 border border-border rounded-lg hover:bg-muted text-foreground font-medium transition-colors"
					>
						Cancel
					</button>
					<button
						onclick={handleConfirm}
						disabled={selectedVoices.length === 0}
						class={cn(
							'flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium transition-colors',
							selectedVoices.length === 0 && 'opacity-50 cursor-not-allowed',
							selectedVoices.length > 0 && 'hover:bg-primary/90'
						)}
					>
						{selectedVoices.length === 0
							? 'Select a Voice'
							: `Confirm ${selectedVoices.length} ${selectedVoices.length === 1 ? 'Voice' : 'Voices'}`}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
