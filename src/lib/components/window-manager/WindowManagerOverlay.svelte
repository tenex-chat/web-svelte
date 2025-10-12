<script lang="ts">
	import { windowManager } from '$lib/stores/windowManager.svelte';
	import Drawer from './Drawer.svelte';
	import DetachedWindow from './DetachedWindow.svelte';

	const drawers = $derived(windowManager.drawers);
	const detachedWindows = $derived(windowManager.detached);
</script>

<!-- Drawers (slide in from right) -->
{#each drawers as window (window.id)}
	<Drawer {window} />
{/each}

<!-- Detached Windows (floating) -->
{#each detachedWindows as window (window.id)}
	<DetachedWindow {window} />
{/each}
