<script lang="ts">
	import { tweened } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	interface Props {
		isActive: boolean;
		audioLevel: number;
		class?: string;
		color?: string;
	}

	let { isActive, audioLevel, class: className, color = 'hsl(0, 0%, 100%)' }: Props = $props();

	// Smooth audio level transitions
	const smoothLevel = tweened(0, {
		duration: 50,
		easing: cubicOut
	});

	$effect(() => {
		smoothLevel.set(audioLevel);
	});

	// Calculate glow size based on audio level
	const glowSize = $derived(isActive ? 20 + $smoothLevel * 30 : 10);

	// Convert HSL to HSLA with alpha channel
	function withAlpha(hslColor: string, alpha: number): string {
		return hslColor.replace('hsl(', 'hsla(').replace(')', `, ${alpha})`);
	}

	// Calculate core scale
	const coreScale = $derived(isActive ? 1 + $smoothLevel * 0.2 : 1);

	// Calculate brightness
	const coreBrightness = $derived(isActive ? 1 + $smoothLevel * 0.3 : 0.6);
</script>

<div class="relative h-24 w-24 {className || ''}">
	<!-- Glow effect -->
	<div
		class="absolute inset-0 rounded-full glow-effect"
		style:box-shadow={isActive
			? `0 0 ${glowSize}px ${glowSize / 2}px ${withAlpha(color, 0.5)}`
			: `0 0 10px 5px ${withAlpha(color, 0.1)}`}
	></div>

	<!-- Core orb -->
	<div
		class="absolute inset-2 rounded-full transition-all duration-[50ms]"
		style:background={isActive ? color : withAlpha(color, 0.4)}
		style:transform="scale({coreScale})"
		style:filter="brightness({coreBrightness})"
	></div>

	<!-- Inner light -->
	<div
		class="absolute inset-4 rounded-full blur-sm inner-light"
		style:background-color={withAlpha(color, 0.6)}
		class:active={isActive}
	></div>
</div>

<style>
	.glow-effect {
		transition: box-shadow 100ms ease-out;
		animation: glow-pulse 2s ease-in-out infinite;
	}

	.inner-light {
		opacity: 0.2;
		transform: scale(1);
		transition:
			opacity 1s ease-in-out,
			transform 1s ease-in-out;
	}

	.inner-light.active {
		animation: inner-pulse 1s ease-in-out infinite;
	}

	@keyframes glow-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.8;
		}
	}

	@keyframes inner-pulse {
		0%,
		100% {
			opacity: 0.4;
			transform: scale(1);
		}
		50% {
			opacity: 0.8;
			transform: scale(1.2);
		}
	}
</style>
