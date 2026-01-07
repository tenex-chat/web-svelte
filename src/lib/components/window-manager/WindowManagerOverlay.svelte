<script lang="ts">
	import { windowManager } from '$lib/stores/windowManager.svelte';
	import Drawer from './Drawer.svelte';
	import DetachedWindow from './DetachedWindow.svelte';

	// Only render the current (top of stack) drawer - not all drawers
	// This eliminates the performance issue of rendering many drawers in the background
	const currentDrawer = $derived(windowManager.currentDrawer);
	const detachedWindows = $derived(windowManager.detached);
</script>

<!-- Single Drawer (top of stack) -->
{#if currentDrawer}
	<Drawer window={currentDrawer} />
{/if}

<!-- Detached Windows (floating) -->
{#each detachedWindows as window (window.id)}
	<DetachedWindow {window} />
{/each}
