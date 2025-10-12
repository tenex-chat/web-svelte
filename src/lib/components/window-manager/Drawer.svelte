<script lang="ts">
	import { windowManager, type WindowConfig } from '$lib/stores/windowManager.svelte';
	import { slide } from 'svelte/transition';
	import ChatView from '../chat/ChatView.svelte';
	import SettingsTab from '../settings/SettingsTab.svelte';
	import { projectStatusStore } from '$lib/stores/projectStatus.svelte';

	interface Props {
		window: WindowConfig;
	}

	let { window }: Props = $props();

	const onlineAgents = $derived(
		window.project ? projectStatusStore.getOnlineAgents(window.project.tagId()) : []
	);

	function handleClose() {
		windowManager.close(window.id);
	}

	function handleDetach() {
		// Calculate center of viewport
		const x = Math.max(100, (globalThis.innerWidth - 800) / 2);
		const y = Math.max(100, (globalThis.innerHeight - 600) / 2);
		windowManager.detach(window.id, { x, y });
	}

	function handleFocus() {
		windowManager.focus(window.id);
	}
</script>

<div
	class="drawer fixed top-0 right-0 bottom-0 w-[800px] bg-white border-l border-gray-200 shadow-2xl flex flex-col"
	style="z-index: {window.zIndex}"
	transition:slide={{ axis: 'x', duration: 200 }}
	onclick={handleFocus}
	role="dialog"
	aria-label={window.title}
>
	<!-- Drawer Header -->
	<div class="drawer-header flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
		<div class="flex items-center gap-3 flex-1 min-w-0">
			<!-- Back/Close button -->
			<button
				onclick={handleClose}
				class="p-1 hover:bg-gray-200 rounded transition-colors"
				aria-label="Close"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
				</svg>
			</button>

			<!-- Title -->
			<div class="flex-1 min-w-0">
				<h2 class="text-sm font-semibold truncate">{window.title}</h2>
				{#if window.project}
					<p class="text-xs text-gray-500 truncate">{window.project.title}</p>
				{/if}
			</div>
		</div>

		<!-- Actions -->
		<div class="flex items-center gap-1">
			<!-- Detach button -->
			<button
				onclick={handleDetach}
				class="p-2 hover:bg-gray-200 rounded transition-colors"
				title="Open in window"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
					/>
				</svg>
			</button>

			<!-- Close button -->
			<button
				onclick={handleClose}
				class="p-2 hover:bg-gray-200 rounded transition-colors"
				title="Close"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					/>
				</svg>
			</button>
		</div>
	</div>

	<!-- Drawer Content -->
	<div class="drawer-content flex-1 overflow-hidden">
		{#if window.type === 'chat'}
			<ChatView
				project={window.project}
				rootEvent={window.data?.thread}
				{onlineAgents}
			/>
		{:else if window.type === 'settings' && window.project}
			<SettingsTab project={window.project} {onlineAgents} />
		{:else if window.type === 'agent'}
			<div class="p-4">
				<h3 class="text-lg font-semibold">Agent: {window.data?.agentName}</h3>
				<p class="text-sm text-gray-500 mt-2">Agent details coming soon...</p>
			</div>
		{:else}
			<div class="p-4">
				<p class="text-sm text-gray-500">Unknown window type: {window.type}</p>
			</div>
		{/if}
	</div>
</div>

<style>
	.drawer {
		max-width: calc(100vw - 320px); /* Leave space for sidebar */
	}
</style>
