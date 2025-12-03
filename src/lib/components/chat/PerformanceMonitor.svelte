<script lang="ts">
	import { performanceMetrics } from '$lib/stores/performance-metrics.svelte';
	import { onMount } from 'svelte';

	// Props
	let { visible = $bindable(false) }: { visible?: boolean } = $props();

	// Local state for smooth updates
	let eventsPerSecond = $state(0);
	let renderFPS = $state(0);
	let lastEventCount = 0;
	let lastRenderCount = 0;
	let updateInterval: ReturnType<typeof setInterval> | null = null;

	// Get summary stats
	const stats = $derived(performanceMetrics.getSummaryStats());

	// Calculate events per second and render FPS
	onMount(() => {
		updateInterval = setInterval(() => {
			const summary = performanceMetrics.getSummaryStats();
			const currentEventCount = summary.conversationState.totalEventsProcessed;
			const currentRenderCount = summary.messageRenders.renderCount;

			eventsPerSecond = currentEventCount - lastEventCount;
			renderFPS = (currentRenderCount - lastRenderCount) * 2; // Update every 500ms, so multiply by 2

			lastEventCount = currentEventCount;
			lastRenderCount = currentRenderCount;
		}, 500);

		return () => {
			if (updateInterval) clearInterval(updateInterval);
		};
	});

	// Keyboard shortcut to toggle
	$effect(() => {
		const handleKeyPress = (e: KeyboardEvent) => {
			if (e.ctrlKey && e.shiftKey && e.key === 'P') {
				e.preventDefault();
				visible = !visible;
			}
		};

		window.addEventListener('keydown', handleKeyPress);
		return () => window.removeEventListener('keydown', handleKeyPress);
	});

	// Toggle enabled state when visibility changes
	$effect(() => {
		if (visible) {
			performanceMetrics.enable();
		}
	});

	// Format large numbers
	function formatNumber(num: number): string {
		if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
		if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
		return num.toString();
	}

	// Get performance color
	function getPerformanceColor(value: number, threshold: number, inverse = false): string {
		if (inverse) {
			return value < threshold ? 'text-green-400' : 'text-red-400';
		}
		return value > threshold ? 'text-red-400' : 'text-green-400';
	}

	function handleClose() {
		visible = false;
		performanceMetrics.disable();
	}

	function handleReset() {
		performanceMetrics.reset();
		eventsPerSecond = 0;
		renderFPS = 0;
		lastEventCount = 0;
		lastRenderCount = 0;
	}
</script>

{#if visible}
	<div class="fixed top-4 right-4 z-50 w-96 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-2xl text-xs font-mono">
		<!-- Header -->
		<div class="flex items-center justify-between p-3 border-b border-gray-700">
			<h3 class="text-sm font-bold text-white">Performance Monitor</h3>
			<div class="flex gap-2">
				<button
					onclick={handleReset}
					class="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
					title="Reset metrics"
				>
					Reset
				</button>
				<button
					onclick={handleClose}
					class="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
					title="Close (Ctrl+Shift+P)"
				>
					×
				</button>
			</div>
		</div>

		<!-- Real-time stats -->
		<div class="p-3 space-y-2 border-b border-gray-700">
			<div class="flex justify-between items-center">
				<span class="text-gray-400">Events/sec:</span>
				<span class={getPerformanceColor(eventsPerSecond, 100, true)}>{eventsPerSecond}</span>
			</div>
			<div class="flex justify-between items-center">
				<span class="text-gray-400">Render FPS:</span>
				<span class={getPerformanceColor(renderFPS, 30, true)}>{renderFPS}</span>
			</div>
			<div class="flex justify-between items-center">
				<span class="text-gray-400">Active Sessions:</span>
				<span class="text-white">{stats.accumulator.totalSessions}</span>
			</div>
		</div>

		<!-- Accumulator metrics -->
		<div class="p-3 space-y-2 border-b border-gray-700">
			<h4 class="text-xs font-bold text-gray-300 mb-2">Delta Accumulator</h4>
			<div class="flex justify-between items-center">
				<span class="text-gray-400">Total Events:</span>
				<span class="text-white">{formatNumber(stats.accumulator.totalEvents)}</span>
			</div>
			<div class="flex justify-between items-center">
				<span class="text-gray-400">Fast Path:</span>
				<span class="text-green-400">{formatNumber(stats.accumulator.totalFastPath)}</span>
			</div>
			<div class="flex justify-between items-center">
				<span class="text-gray-400">Slow Path:</span>
				<span class={stats.accumulator.totalSlowPath > 0 ? 'text-yellow-400' : 'text-white'}>
					{formatNumber(stats.accumulator.totalSlowPath)}
				</span>
			</div>
			<div class="flex justify-between items-center">
				<span class="text-gray-400">Slow Reconstructions:</span>
				<span class={stats.accumulator.totalSlowReconstructions > 0 ? 'text-red-400' : 'text-white'}>
					{stats.accumulator.totalSlowReconstructions}
				</span>
			</div>
			<div class="flex justify-between items-center">
				<span class="text-gray-400">Avg Reconstruct:</span>
				<span class={getPerformanceColor(stats.accumulator.avgReconstructTime, 10, true)}>
					{stats.accumulator.avgReconstructTime.toFixed(2)}ms
				</span>
			</div>
		</div>

		<!-- Conversation state metrics -->
		<div class="p-3 space-y-2 border-b border-gray-700">
			<h4 class="text-xs font-bold text-gray-300 mb-2">Conversation State</h4>
			<div class="flex justify-between items-center">
				<span class="text-gray-400">Events Processed:</span>
				<span class="text-white">{formatNumber(stats.conversationState.totalEventsProcessed)}</span>
			</div>
			<div class="flex justify-between items-center">
				<span class="text-gray-400">Streaming Events:</span>
				<span class="text-white">{formatNumber(stats.conversationState.totalStreamingEvents)}</span>
			</div>
			<div class="flex justify-between items-center">
				<span class="text-gray-400">Computations:</span>
				<span class="text-white">{formatNumber(stats.conversationState.totalComputations)}</span>
			</div>
			<div class="flex justify-between items-center">
				<span class="text-gray-400">Slow Computations:</span>
				<span class={stats.conversationState.totalSlowComputations > 0 ? 'text-red-400' : 'text-white'}>
					{stats.conversationState.totalSlowComputations}
				</span>
			</div>
			<div class="flex justify-between items-center">
				<span class="text-gray-400">Avg Compute:</span>
				<span class={getPerformanceColor(stats.conversationState.avgComputeTime, 50, true)}>
					{stats.conversationState.avgComputeTime.toFixed(2)}ms
				</span>
			</div>
		</div>

		<!-- Message render metrics -->
		<div class="p-3 space-y-2">
			<h4 class="text-xs font-bold text-gray-300 mb-2">Message Rendering</h4>
			<div class="flex justify-between items-center">
				<span class="text-gray-400">Render Count:</span>
				<span class="text-white">{formatNumber(stats.messageRenders.renderCount)}</span>
			</div>
			<div class="flex justify-between items-center">
				<span class="text-gray-400">Slow Renders:</span>
				<span class={stats.messageRenders.slowRenderCount > 0 ? 'text-red-400' : 'text-white'}>
					{stats.messageRenders.slowRenderCount}
				</span>
			</div>
			<div class="flex justify-between items-center">
				<span class="text-gray-400">Avg Render:</span>
				<span class={getPerformanceColor(stats.messageRenders.avgRenderTime, 16, true)}>
					{stats.messageRenders.avgRenderTime.toFixed(2)}ms
				</span>
			</div>
			<div class="flex justify-between items-center">
				<span class="text-gray-400">Last Render:</span>
				<span class={getPerformanceColor(stats.messageRenders.lastRenderTime, 16, true)}>
					{stats.messageRenders.lastRenderTime.toFixed(2)}ms
				</span>
			</div>
		</div>

		<!-- Footer with help text -->
		<div class="p-2 bg-gray-800 text-gray-500 text-[10px] text-center rounded-b-lg">
			Press <kbd class="px-1 bg-gray-700 rounded">Ctrl+Shift+P</kbd> to toggle
		</div>
	</div>
{/if}