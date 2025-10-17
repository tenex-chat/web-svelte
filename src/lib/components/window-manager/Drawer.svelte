<script lang="ts">
	import { windowManager, type WindowConfig } from '$lib/stores/windowManager.svelte';
	import { slide } from 'svelte/transition';
	import ChatView from '../chat/ChatView.svelte';
	import SettingsTab from '../settings/SettingsTab.svelte';
	import DocumentView from '../docs/DocumentView.svelte';
	import CallView from '../call/CallView.svelte';
	import { projectStatusStore } from '$lib/stores/projectStatus.svelte';
	import type { ThreadViewMode } from '$lib/utils/messageProcessor';
	import type { Message } from '$lib/utils/messageProcessor';
	import CopyThreadMenu from '../chat/CopyThreadMenu.svelte';

	interface Props {
		window: WindowConfig;
	}

	let { window }: Props = $props();

	let viewMode = $state<ThreadViewMode>('threaded');
	let messages = $state<Message[]>([]);

	const STORAGE_KEY = 'drawer-width-vw';
	const DEFAULT_WIDTH_VW = 41.67; // ~800px at 1920px width
	const MIN_WIDTH_VW = 20;
	const MAX_WIDTH_VW = 80;

	let widthVw = $state(DEFAULT_WIDTH_VW);
	let isResizing = $state(false);

	const onlineAgents = $derived(
		window.project ? projectStatusStore.getOnlineAgents(window.project.tagId()) : []
	);

	$effect(() => {
		if (typeof localStorage !== 'undefined') {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				const parsed = parseFloat(stored);
				if (!isNaN(parsed) && parsed >= MIN_WIDTH_VW && parsed <= MAX_WIDTH_VW) {
					widthVw = parsed;
				}
			}
		}
	});

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

	function toggleViewMode() {
		viewMode = viewMode === 'threaded' ? 'flattened' : 'threaded';
	}

	function handleResizeStart(e: MouseEvent) {
		e.preventDefault();
		isResizing = true;

		const handleMouseMove = (e: MouseEvent) => {
			if (!isResizing) return;

			const viewportWidth = globalThis.innerWidth;
			const distanceFromRight = viewportWidth - e.clientX;
			let newWidthVw = (distanceFromRight / viewportWidth) * 100;

			newWidthVw = Math.max(MIN_WIDTH_VW, Math.min(MAX_WIDTH_VW, newWidthVw));
			widthVw = newWidthVw;
		};

		const handleMouseUp = () => {
			if (isResizing) {
				isResizing = false;
				if (typeof localStorage !== 'undefined') {
					localStorage.setItem(STORAGE_KEY, widthVw.toString());
				}
			}
			document.removeEventListener('mousemove', handleMouseMove);
			document.removeEventListener('mouseup', handleMouseUp);
		};

		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
	}
</script>

<div
	class="drawer fixed top-0 right-0 bottom-0 bg-card border-l border-border shadow-2xl flex flex-col"
	style="width: {widthVw}vw; z-index: {window.zIndex}; {isResizing ? 'user-select: none;' : ''}"
	transition:slide={{ axis: 'x', duration: 200 }}
	onclick={handleFocus}
	role="dialog"
	aria-label={window.title}
>
	<!-- Resize Handle -->
	<div
		class="resize-handle absolute top-0 left-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-500/50 transition-colors"
		onmousedown={handleResizeStart}
		role="separator"
		aria-label="Resize drawer"
		aria-orientation="vertical"
	></div>
	<!-- Drawer Header -->
	<div class="drawer-header flex items-center justify-between px-4 py-3 border-b border-border bg-muted dark:bg-zinc-800">
		<div class="flex items-center gap-3 flex-1 min-w-0">
			<!-- Back/Close button -->
			<button
				onclick={handleClose}
				class="p-1 hover:bg-secondary dark:hover:bg-zinc-700 rounded transition-colors"
				aria-label="Close"
			>
				<svg class="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
				</svg>
			</button>

			<!-- Title -->
			<div class="flex-1 min-w-0">
				<h2 class="text-sm font-semibold text-foreground truncate">{window.title}</h2>
				{#if window.project}
					<p class="text-xs text-muted-foreground truncate">{window.project.title}</p>
				{/if}
			</div>
		</div>

		<!-- Actions -->
		<div class="flex items-center gap-1">
			{#if window.type === 'chat'}
				<!-- Copy Thread Menu -->
				<CopyThreadMenu {messages} rootEvent={window.data?.thread} />

				<!-- View Mode Toggle -->
				<button
					onclick={toggleViewMode}
					class="p-2 hover:bg-secondary dark:hover:bg-zinc-700 rounded transition-colors"
					title={viewMode === 'threaded' ? 'Switch to flat view' : 'Switch to threaded view'}
				>
					{#if viewMode === 'threaded'}
						<svg class="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 6h16M4 12h16M4 18h7"
							/>
						</svg>
					{:else}
						<svg class="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 6h16M4 12h16M4 18h16"
							/>
						</svg>
					{/if}
				</button>
			{/if}

			<!-- Detach button -->
			<button
				onclick={handleDetach}
				class="p-2 hover:bg-secondary dark:hover:bg-zinc-700 rounded transition-colors"
				title="Open in window"
			>
				<svg class="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
				class="p-2 hover:bg-secondary dark:hover:bg-zinc-700 rounded transition-colors"
				title="Close"
			>
				<svg class="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
				onThreadCreated={(thread) => {
					// Update the window data with the new thread
					windowManager.updateWindowData(
						window.id,
						{ thread },
						thread.tagValue('title') || 'Conversation'
					);
				}}
				{viewMode}
				hideHeader={true}
				bind:messages
			/>
		{:else if window.type === 'settings' && window.project}
			<SettingsTab project={window.project} {onlineAgents} />
		{:else if window.type === 'document'}
			<DocumentView
				document={window.data?.document}
				project={window.project}
				onBack={handleClose}
			/>
		{:else if window.type === 'call' && window.project}
			<CallView
				project={window.project}
				rootEvent={window.data?.thread}
				onClose={(rootEvent) => {
					// Update the window data with the thread if created during call
					if (rootEvent && !window.data?.thread) {
						windowManager.updateWindowData(
							window.id,
							{ thread: rootEvent },
							`Voice Call - ${window.project?.title}`
						);
					}
					handleClose();
				}}
				isEmbedded={true}
			/>
		{:else if window.type === 'agent'}
			<div class="p-4">
				<h3 class="text-lg font-semibold text-foreground">Agent: {window.data?.agentName}</h3>
				<p class="text-sm text-muted-foreground mt-2">Agent details coming soon...</p>
			</div>
		{:else}
			<div class="p-4">
				<p class="text-sm text-muted-foreground">Unknown window type: {window.type}</p>
			</div>
		{/if}
	</div>
</div>

<style>
	.drawer {
		max-width: calc(100vw - 320px); /* Leave space for sidebar */
	}

	.resize-handle {
		z-index: 10;
	}

	.resize-handle:active {
		background-color: rgb(59 130 246 / 0.7);
	}
</style>
