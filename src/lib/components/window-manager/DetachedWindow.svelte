<script lang="ts">
	import { windowManager, type WindowConfig } from '$lib/stores/windowManager.svelte';
	import { fade } from 'svelte/transition';
	import ChatView from '../chat/ChatView.svelte';
	import SettingsTab from '../settings/SettingsTab.svelte';
	import DocumentView from '../docs/DocumentView.svelte';
	import CallView from '../call/CallView.svelte';
	import AgentProfileTabs from '../agents/AgentProfileTabs.svelte';
	import DebugEventsView from '../debug/DebugEventsView.svelte';
	import { projectStatusStore } from '$lib/stores/projectStatus.svelte';
	import type { ChatViewMode, Message } from '$lib/utils/messageUtils';
	import ChatHeaderActions from '../chat/ChatHeaderActions.svelte';

	interface Props {
		window: WindowConfig;
	}

	let { window }: Props = $props();

	let viewMode = $state<ChatViewMode>('threaded');
	let messages = $state<Message[]>([]);

	const onlineAgents = $derived(
		window.project ? projectStatusStore.getOnlineAgents(window.project.tagId()) : []
	);

	// For agent windows, get agent pubkey
	const agentPubkey = $derived(window.type === 'agent' ? window.data?.agentPubkey : null);

	let isDragging = $state(false);
	let isResizing = $state(false);
	let resizeEdge = $state<'right' | 'bottom' | 'bottom-right' | null>(null);
	let dragOffset = $state({ x: 0, y: 0 });
	let resizeStart = $state({ x: 0, y: 0, width: 0, height: 0 });

	function handleClose() {
		windowManager.close(window.id);
	}

	function handleAttach() {
		windowManager.attach(window.id);
	}

	function handleFocus() {
		windowManager.focus(window.id);
	}

	function handleMouseDownDrag(e: MouseEvent) {
		if (!window.position) return;
		isDragging = true;
		dragOffset = {
			x: e.clientX - window.position.x,
			y: e.clientY - window.position.y
		};
		handleFocus();
	}

	function handleEdgeResize(e: MouseEvent, edge: 'right' | 'bottom' | 'bottom-right') {
		if (!window.position || !window.size) return;
		isResizing = true;
		resizeEdge = edge;
		resizeStart = {
			x: e.clientX,
			y: e.clientY,
			width: window.size.width,
			height: window.size.height
		};
		handleFocus();
		e.stopPropagation();
		e.preventDefault();
	}

	function handleMouseMove(e: MouseEvent) {
		if (isDragging && window.position) {
			windowManager.updatePosition(window.id, {
				x: e.clientX - dragOffset.x,
				y: e.clientY - dragOffset.y
			});
		} else if (isResizing && window.size && resizeEdge) {
			const deltaX = e.clientX - resizeStart.x;
			const deltaY = e.clientY - resizeStart.y;

			let newWidth = resizeStart.width;
			let newHeight = resizeStart.height;

			if (resizeEdge === 'right' || resizeEdge === 'bottom-right') {
				newWidth = Math.max(400, resizeStart.width + deltaX);
			}
			if (resizeEdge === 'bottom' || resizeEdge === 'bottom-right') {
				newHeight = Math.max(300, resizeStart.height + deltaY);
			}

			windowManager.updateSize(window.id, {
				width: newWidth,
				height: newHeight
			});
		}
	}

	function handleMouseUp() {
		isDragging = false;
		isResizing = false;
		resizeEdge = null;
	}

	$effect(() => {
		if (isDragging || isResizing) {
			globalThis.addEventListener('mousemove', handleMouseMove);
			globalThis.addEventListener('mouseup', handleMouseUp);
			return () => {
				globalThis.removeEventListener('mousemove', handleMouseMove);
				globalThis.removeEventListener('mouseup', handleMouseUp);
			};
		}
	});

</script>

<div
	class="detached-window fixed bg-card rounded-lg shadow-2xl border border-border flex flex-col overflow-hidden"
	style="
		left: {window.position?.x ?? 0}px;
		top: {window.position?.y ?? 0}px;
		width: {window.size?.width ?? 800}px;
		height: {window.size?.height ?? 600}px;
		z-index: {window.zIndex};
		cursor: {isDragging ? 'grabbing' : 'default'};
	"
	transition:fade={{ duration: 150 }}
	onclick={handleFocus}
	role="dialog"
	aria-label={window.title}
>
	<!-- Window Header -->
	<div
		class="window-header flex items-center justify-between px-4 py-2 border-b border-border bg-muted"
		onmousedown={handleMouseDownDrag}
		style="cursor: {isDragging ? 'grabbing' : 'grab'}"
	>
		<div class="flex items-center gap-3 flex-1 min-w-0 pointer-events-none">
			<!-- Title -->
			<div class="flex-1 min-w-0">
				<h2 class="text-sm font-semibold text-foreground truncate">{window.title}</h2>
				{#if window.project}
					<p class="text-xs text-muted-foreground truncate">{window.project.title}</p>
				{/if}
			</div>
		</div>

		<!-- Actions -->
		<div class="flex items-center gap-1 pointer-events-auto">
			{#if window.type === 'chat'}
				<ChatHeaderActions
					rootEvent={window.data?.thread}
					{messages}
					bind:viewMode
				/>
			{/if}

			<!-- Re-attach button -->
			<button
				onclick={handleAttach}
				class="p-2 hover:bg-secondary rounded transition-colors"
				title="Dock to sidebar"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 6h16M4 12h16M4 18h16"
					/>
				</svg>
			</button>

			<!-- Close button -->
			<button
				onclick={handleClose}
				class="p-2 hover:bg-secondary rounded transition-colors"
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

	<!-- Window Content -->
	<div class="window-content flex-1 overflow-hidden">
		{#if window.type === 'chat'}
			{#key window.id}
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

	<!-- Resize Handles -->
	<!-- Right edge -->
	<div
		class="resize-edge absolute top-0 right-0 w-2 hover:bg-primary/30 transition-colors z-[200]"
		style="cursor: ew-resize; bottom: 16px;"
		onmousedown={(e) => handleEdgeResize(e, 'right')}
		role="separator"
		aria-label="Resize window horizontally"
	></div>
	<!-- Bottom edge -->
	<div
		class="resize-edge absolute bottom-0 left-0 h-2 hover:bg-primary/30 transition-colors z-[200]"
		style="cursor: ns-resize; right: 12px;"
		onmousedown={(e) => handleEdgeResize(e, 'bottom')}
		role="separator"
		aria-label="Resize window vertically"
	></div>
	<!-- Bottom-right corner - larger hit area -->
	<div
		class="resize-corner absolute bottom-0 right-0 w-4 h-4 z-[200]"
		style="cursor: nwse-resize;"
		onmousedown={(e) => handleEdgeResize(e, 'bottom-right')}
		role="button"
		tabindex="-1"
		aria-label="Resize window"
	></div>
</div>

<style>
	.detached-window {
		user-select: none;
		min-width: 400px;
		min-height: 300px;
	}

	/* Resize edge handles - invisible but with larger hit area */
	.resize-edge {
		/* Expand hit area beyond visible element */
		padding: 4px;
		margin: -4px;
	}

	/* Corner resize handle with visual indicator */
	.resize-corner {
		background: linear-gradient(135deg, transparent 50%, rgba(156, 163, 175, 0.5) 50%);
	}

	.resize-corner:hover {
		background: linear-gradient(135deg, transparent 50%, rgba(59, 130, 246, 0.6) 50%);
	}

	:global(.dark) .resize-corner {
		background: linear-gradient(135deg, transparent 50%, rgba(107, 114, 128, 0.5) 50%);
	}

	:global(.dark) .resize-corner:hover {
		background: linear-gradient(135deg, transparent 50%, rgba(59, 130, 246, 0.6) 50%);
	}
</style>
