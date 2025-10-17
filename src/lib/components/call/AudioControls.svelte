<script lang="ts">
	import { PhoneOff, Mic, MicOff, Send } from 'lucide-svelte';
	import { tweened } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	interface Props {
		isRecording: boolean;
		isProcessing: boolean;
		hasTranscript: boolean;
		audioLevel: number;
		isVADEnabled?: boolean;
		isVADPaused?: boolean;
		onEndCall: () => void;
		onMicToggle: () => void;
		onSend: () => void;
	}

	let {
		isRecording,
		isProcessing,
		hasTranscript,
		audioLevel,
		isVADEnabled = false,
		isVADPaused = false,
		onEndCall,
		onMicToggle,
		onSend
	}: Props = $props();

	// Smooth audio level for visualizations
	const smoothLevel = tweened(0, {
		duration: 50,
		easing: cubicOut
	});

	$effect(() => {
		smoothLevel.set(audioLevel);
	});

	const levelScale = $derived(1 + $smoothLevel * 0.5);
</script>

<div class="flex items-center justify-center gap-4 p-6">
	<!-- End call button -->
	<button
		onclick={onEndCall}
		class="h-16 w-16 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 active:scale-95 transition-all"
		aria-label="End call"
	>
		<PhoneOff class="h-7 w-7 text-white" />
	</button>

	<!-- Mic toggle button -->
	<button
		onclick={onMicToggle}
		disabled={isProcessing}
		class="relative h-16 w-16 overflow-hidden rounded-full flex items-center justify-center active:scale-95 transition-all {isRecording
			? 'bg-card text-foreground'
			: isVADEnabled && isVADPaused
			? 'bg-muted text-foreground hover:bg-muted/80'
			: isVADEnabled
			? 'bg-green-500/20 text-green-500 hover:bg-green-500/30'
			: 'bg-muted text-foreground hover:bg-muted/80'} disabled:opacity-50 disabled:cursor-not-allowed"
		aria-label={isVADEnabled
			? isVADPaused
				? 'Resume VAD'
				: 'Pause VAD'
			: isRecording
			? 'Stop recording'
			: 'Start recording'}
	>
		<!-- Recording indicator ring -->
		{#if isRecording}
			<div class="absolute inset-0 rounded-full recording-ring"></div>
		{/if}

		<!-- Audio level visualization -->
		{#if isRecording}
			<div
				class="absolute inset-0 rounded-full bg-red-500/20 transition-transform duration-[50ms]"
				style:transform="scale({levelScale})"
			></div>
		{/if}

		<div class="relative z-10">
			{#if isVADEnabled && isVADPaused}
				<MicOff class="h-7 w-7" />
			{:else if isRecording}
				<Mic class="h-7 w-7 animate-pulse" />
			{:else}
				<Mic class="h-7 w-7" />
			{/if}
		</div>
	</button>

	<!-- Send button -->
	<button
		onclick={onSend}
		disabled={!hasTranscript || isProcessing}
		class="h-16 w-16 rounded-full flex items-center justify-center active:scale-95 transition-all {hasTranscript &&
		!isProcessing
			? 'bg-green-500 hover:bg-green-600 text-white'
			: 'bg-muted text-muted-foreground cursor-not-allowed'}"
		aria-label="Send message"
	>
		<Send class="h-7 w-7" />
	</button>
</div>

<style>
	.recording-ring {
		border: 3px solid rgb(239, 68, 68); /* red-500 */
		animation: pulse-ring 1.5s ease-out infinite;
	}

	@keyframes pulse-ring {
		0%,
		100% {
			transform: scale(1);
			opacity: 1;
		}
		50% {
			transform: scale(1.3);
			opacity: 0;
		}
	}
</style>
