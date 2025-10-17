<script lang="ts">
	import type { CallState } from '$lib/stores/call-store.svelte';

	interface Props {
		callState: CallState;
		transcript: string;
		isVADEnabled?: boolean;
	}

	let { callState, transcript, isVADEnabled = false }: Props = $props();
</script>

<div class="mt-4 min-h-[60px] w-full max-w-md text-center">
	{#if callState === 'initializing'}
		<div class="text-white/60">Initializing call...</div>
	{:else if callState === 'recording'}
		<div class="text-white">
			<span class="inline-flex items-center gap-2">
				<span class="h-2 w-2 animate-pulse rounded-full bg-red-500"></span>
				Listening...
			</span>
		</div>
	{:else if callState === 'processing'}
		<div class="text-white/60">
			<div class="mb-2">Processing...</div>
			{#if transcript}
				<div class="text-sm italic text-white/40">"{transcript}"</div>
			{/if}
		</div>
	{:else if callState === 'playing'}
		<div class="text-white/60">Agent speaking...</div>
	{:else if callState === 'idle'}
		{#if transcript}
			<div class="text-sm text-white/40">Last: "{transcript}"</div>
		{:else if isVADEnabled}
			<div class="text-white/60">Start speaking to begin</div>
		{:else}
			<div class="text-white/60">Click the microphone to speak</div>
		{/if}
	{/if}
</div>
