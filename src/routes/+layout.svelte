<script lang="ts">
	import { ndkReady } from '$lib/ndk.svelte';
	import { browser } from '$app/environment';
	import { projectStatusStore } from '$lib/stores/projectStatus.svelte';
	import { uiSettingsStore } from '$lib/stores/uiSettings.svelte';
	import LoginModal from '$lib/components/LoginModal.svelte';
	import WindowManagerOverlay from '$lib/components/window-manager/WindowManagerOverlay.svelte';
	import '../app.css';

	// Initialize UI settings (including theme)
	uiSettingsStore;

	let { children } = $props();

	let ready = $state(false);

	// Wait for NDK cache to be initialized before mounting the app
	if (browser) {
		ndkReady.then(() => {
			ready = true;
		});
	} else {
		// On server, always render
		ready = true;
	}

	// Initialize project status store when component mounts
	$effect(() => {
		if (ready && browser) {
			projectStatusStore.init();
		}
	});
</script>

<svelte:head>
	<title>TENEX</title>
</svelte:head>

<LoginModal />

{#if ready}
	{@render children?.()}

	<!-- Window Manager (Drawers + Floating Windows) -->
	<WindowManagerOverlay />
{:else}
	<div class="flex items-center justify-center min-h-screen bg-white dark:bg-zinc-950">
		<div class="text-center">
			<div
				class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"
			></div>
			<p class="mt-4 text-gray-600 dark:text-gray-400">Initializing...</p>
		</div>
	</div>
{/if}
