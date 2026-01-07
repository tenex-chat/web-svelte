<script lang="ts">
	import { windowManager, type WindowConfig } from '$lib/stores/windowManager.svelte';
	import ChatView from '../chat/ChatView.svelte';
	import SettingsTab from '../settings/SettingsTab.svelte';
	import DocumentView from '../docs/DocumentView.svelte';
	import CallView from '../call/CallView.svelte';
	import AgentProfileTabs from '../agents/AgentProfileTabs.svelte';
	import ChatHeaderActions from '../chat/ChatHeaderActions.svelte';
	import ConversationMetadataDisplay from '../chat/ConversationMetadataDisplay.svelte';
	import DebugEventsView from '../debug/DebugEventsView.svelte';
	import { projectStatusStore } from '$lib/stores/projectStatus.svelte';
	import type { ChatViewMode, Message } from '$lib/utils/messageUtils';
	import { storage } from '$lib/utils/storage.svelte';

	interface Props {
		window: WindowConfig;
	}

	let { window }: Props = $props();

	let viewMode = $state<ChatViewMode>('threaded');
	let messages = $state<Message[]>([]);

	const DEFAULT_WIDTH_VW = 65;
	const MIN_WIDTH_VW = 20;
	const MAX_WIDTH_VW = 95;

	let widthVw = $state(DEFAULT_WIDTH_VW);
	let isResizing = $state(false);

	const onlineAgents = $derived(
		window.project ? projectStatusStore.getOnlineAgents(window.project.tagId()) : []
	);

	// For agent windows, get agent pubkey
	const agentPubkey = $derived(window.type === 'agent' ? window.data?.agentPubkey : null);

	// Check if we can navigate back (more than one item in stack)
	const canNavigateBack = $derived(windowManager.canNavigateBack);
	const stackSize = $derived(windowManager.drawerStackSize);

	$effect(() => {
		const stored = storage.get('drawer-width');
		if (stored && stored >= MIN_WIDTH_VW && stored <= MAX_WIDTH_VW) {
			widthVw = stored;
		}
	});

	/**
	 * Navigate back in the stack (pops current conversation)
	 * If at bottom of stack, closes the drawer
	 */
	function handleBack() {
		windowManager.navigateBack();
	}

	/**
	 * Close the entire drawer (hides it, but stack remains intact)
	 */
	function handleCloseDrawer() {
		windowManager.closeDrawer();
	}

	/**
	 * Used by child components (DocumentView, CallView) that want to "close" themselves
	 * This navigates back in the stack rather than closing the entire drawer
	 */
	function handleClose() {
		windowManager.navigateBack();
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
				storage.set('drawer-width', widthVw);
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
	<div class="drawer-header flex items-center justify-between px-4 py-3 border-b border-border bg-muted">
		<div class="flex items-center gap-3 flex-1 min-w-0">
			<!-- Back button - navigates to previous conversation in stack -->
			<button
				onclick={handleBack}
				class="p-1 hover:bg-secondary rounded transition-colors"
				aria-label={canNavigateBack ? "Go back" : "Close drawer"}
				title={canNavigateBack ? `Back (${stackSize - 1} more in stack)` : "Close drawer"}
			>
				<svg class="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
				</svg>
			</button>

			<!-- Title -->
			<div class="flex-1 min-w-0">
				<div class="flex items-center gap-2">
					<h2 class="text-sm font-semibold text-foreground truncate">{window.title}</h2>
					{#if stackSize > 1}
						<span class="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full">
							{stackSize}
						</span>
					{/if}
				</div>
				{#if window.type === 'chat' && window.data?.thread}
					<ConversationMetadataDisplay
						conversationId={window.data.thread.id}
						showSummary={true}
						summaryClass="text-xs text-muted-foreground italic truncate mt-1"
					/>
				{/if}
				{#if window.project}
					<p class="text-xs text-muted-foreground truncate">{window.project.title}</p>
				{/if}
			</div>
		</div>

		<!-- Actions -->
		<div class="flex items-center gap-1">
			{#if window.type === 'chat'}
				<ChatHeaderActions
					rootEvent={window.data?.thread}
					{messages}
					bind:viewMode
				/>
			{/if}

			<!-- Detach button -->
			<button
				onclick={handleDetach}
				class="p-2 hover:bg-secondary rounded transition-colors"
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

			<!-- Close button - closes drawer but preserves stack -->
			<button
				onclick={handleCloseDrawer}
				class="p-2 hover:bg-secondary rounded transition-colors"
				title="Close drawer"
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
			{@const thread = window.data?.thread}
			<!-- Key by window.id to force full re-render when switching windows in the stack -->
			{#key window.id}
				<ChatView
					project={window.project}
					rootEvent={thread}
					{onlineAgents}
					onThreadCreated={(thread) => {
						// Update the window data with the new thread
						windowManager.updateWindowData(
							window.id,
							{ thread },
							thread.tagValue('title') || 'Conversation'
						);
					}}
					bind:viewMode
					hideHeader={true}
					bind:messages
					windowId={window.id}
				/>
			{/key}
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
		{:else if window.type === 'agent' && agentPubkey}
			<AgentProfileTabs pubkey={agentPubkey} />
		{:else if window.type === 'debug-events'}
			<DebugEventsView rootEvent={window.data?.rootEvent} />
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
