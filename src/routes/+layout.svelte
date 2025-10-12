<script lang="ts">
	import { ndkReady } from '$lib/ndk.svelte';
	import { browser } from '$app/environment';
	import { projectStatusStore } from '$lib/stores/projectStatus.svelte';
	import LoginModal from '$lib/components/LoginModal.svelte';
	import WindowManagerOverlay from '$lib/components/window-manager/WindowManagerOverlay.svelte';
	import ProjectStatusDebug from '$lib/components/debug/ProjectStatusDebug.svelte';
	import '../app.css';

	let { children } = $props();

	let ready = $state(false);
	let showDebug = $state(false);

	// Wait for NDK cache to be initialized before mounting the app
	if (browser) {
		ndkReady.then(() => {
			ready = true;
		});

		// Check if debug mode is enabled via query param or localStorage
		const params = new URLSearchParams(window.location.search);
		if (params.get('debug') === 'true' || localStorage.getItem('tenex-debug') === 'true') {
			showDebug = true;
		}
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

	// Global keyboard shortcut: Ctrl+Shift+D to toggle debug
	function handleKeyDown(e: KeyboardEvent) {
		if (e.ctrlKey && e.shiftKey && e.key === 'D') {
			e.preventDefault();
			showDebug = !showDebug;
			if (browser) {
				localStorage.setItem('tenex-debug', showDebug ? 'true' : 'false');
			}
		}
	}
</script>

<svelte:head>
	<title>TENEX</title>
</svelte:head>

<svelte:window onkeydown={handleKeyDown} />

<LoginModal />

{#if ready}
	{@render children?.()}

	<!-- Window Manager (Drawers + Floating Windows) -->
	<WindowManagerOverlay />

	<!-- Debug Panel (Ctrl+Shift+D to toggle) -->
	{#if showDebug}
		<ProjectStatusDebug />
	{/if}
{:else}
	<div class="flex items-center justify-center min-h-screen bg-white">
		<div class="text-center">
			<div
				class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"
			></div>
			<p class="mt-4 text-gray-600">Initializing...</p>
		</div>
	</div>
{/if}
