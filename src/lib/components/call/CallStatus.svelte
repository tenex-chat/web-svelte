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
		<div class="text-muted-foreground">Initializing call...</div>
	{:else if callState === 'recording'}
		<div class="text-foreground">
			<span class="inline-flex items-center gap-2">
				<span class="h-2 w-2 animate-pulse rounded-full bg-destructive"></span>
				Listening...
			</span>
		</div>
	{:else if callState === 'processing'}
		<div class="text-muted-foreground">
			<div class="mb-2">Processing...</div>
			{#if transcript}
				<div class="text-sm italic text-muted-foreground/60">"{transcript}"</div>
			{/if}
		</div>
	{:else if callState === 'playing'}
		<div class="text-muted-foreground">Agent speaking...</div>
	{:else if callState === 'idle'}
		{#if transcript}
			<div class="text-sm text-muted-foreground/60">Last: "{transcript}"</div>
		{:else if isVADEnabled}
			<div class="text-muted-foreground">Start speaking to begin</div>
		{:else}
			<div class="text-muted-foreground">Click the microphone to speak</div>
		{/if}
	{/if}
</div>
