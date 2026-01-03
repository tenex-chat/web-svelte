<script lang="ts">
	import { ndk, ndkReady } from '$lib/ndk.svelte';
	import { browser } from '$app/environment';
	import { projectStatusStore } from '$lib/stores/projectStatus.svelte';
	import { operationsStatusStore } from '$lib/stores/operationsStatus.svelte';
	import { uiSettingsStore } from '$lib/stores/uiSettings.svelte';
	import LoginModal from '$lib/components/LoginModal.svelte';
	import WindowManagerOverlay from '$lib/components/window-manager/WindowManagerOverlay.svelte';
	import ToastContainer from '$lib/components/ui/ToastContainer.svelte';
	import { NDKKind } from '$lib/kinds';
	import { conversationMetadataStore } from '$lib/stores/conversationMetadata.svelte';
	import { processConversationMetadataEvent } from '$lib/utils/conversationMetadataProcessor';
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

	// Initialize stores when component mounts
	$effect(() => {
		if (ready && browser) {
			projectStatusStore.init();
			operationsStatusStore.init();
		}
	});

	// Global subscription for conversation metadata (kind 513)
	const metadataSubscription = ndk.$subscribe(() => ({
		filters: [{ kinds: [NDKKind.TenexConversationMetadata as number] }],
		closeOnEose: false
	}));

	$effect(() => {
		const events = metadataSubscription.events;
		if (events && events.length > 0) {
			events.forEach((event) => {
				const conversationId = event.tags.find((tag) => tag[0] === 'e')?.[1];
				if (conversationId) {
					const currentMetadata = conversationMetadataStore.getMetadata(conversationId);
					const result = processConversationMetadataEvent(event, currentMetadata);

					if (result.success && (result.title || result.summary)) {
						conversationMetadataStore.setMetadata(result.conversationId, {
							title: result.title,
							summary: result.summary
						});
					}
				}
			});
		}
	});
</script>

<svelte:head>
	<title>TENEX</title>
</svelte:head>

<LoginModal />
<ToastContainer />

{#if ready}
	{@render children?.()}

	<!-- Window Manager (Drawers + Floating Windows) -->
	<WindowManagerOverlay />
{:else}
	<div class="flex items-center justify-center min-h-screen bg-background">
		<div class="text-center">
			<div
				class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"
			></div>
			<p class="mt-4 text-muted-foreground">Initializing...</p>
		</div>
	</div>
{/if}
