<script lang="ts">
	import { windowManager, type WindowConfig } from '$lib/stores/windowManager.svelte';
	import { fade } from 'svelte/transition';
	import ChatView from '../chat/ChatView.svelte';
	import SettingsTab from '../settings/SettingsTab.svelte';
	import DocumentView from '../docs/DocumentView.svelte';
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

	const onlineAgents = $derived(
		window.project ? projectStatusStore.getOnlineAgents(window.project.tagId()) : []
	);

	let isDragging = $state(false);
	let isResizing = $state(false);
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

	function handleMouseDownResize(e: MouseEvent) {
		if (!window.position || !window.size) return;
		isResizing = true;
		resizeStart = {
			x: e.clientX,
			y: e.clientY,
			width: window.size.width,
			height: window.size.height
		};
		handleFocus();
		e.stopPropagation();
	}

	function handleMouseMove(e: MouseEvent) {
		if (isDragging && window.position) {
			windowManager.updatePosition(window.id, {
				x: e.clientX - dragOffset.x,
				y: e.clientY - dragOffset.y
			});
		} else if (isResizing && window.size) {
			const deltaX = e.clientX - resizeStart.x;
			const deltaY = e.clientY - resizeStart.y;
			windowManager.updateSize(window.id, {
				width: Math.max(400, resizeStart.width + deltaX),
				height: Math.max(300, resizeStart.height + deltaY)
			});
		}
	}

	function handleMouseUp() {
		isDragging = false;
		isResizing = false;
	}

	function toggleViewMode() {
		viewMode = viewMode === 'threaded' ? 'flattened' : 'threaded';
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
	class="detached-window fixed bg-white dark:bg-zinc-900 rounded-lg shadow-2xl border border-gray-300 dark:border-zinc-700 flex flex-col overflow-hidden"
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
		class="window-header flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800"
		onmousedown={handleMouseDownDrag}
		style="cursor: {isDragging ? 'grabbing' : 'grab'}"
	>
		<div class="flex items-center gap-3 flex-1 min-w-0 pointer-events-none">
			<!-- Title -->
			<div class="flex-1 min-w-0">
				<h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{window.title}</h2>
				{#if window.project}
					<p class="text-xs text-gray-500 dark:text-gray-400 truncate">{window.project.title}</p>
				{/if}
			</div>
		</div>

		<!-- Actions -->
		<div class="flex items-center gap-1 pointer-events-auto">
			{#if window.type === 'chat'}
				<!-- Copy Thread Menu -->
				<CopyThreadMenu {messages} rootEvent={window.data?.thread} />

				<!-- View Mode Toggle -->
				<button
					onclick={toggleViewMode}
					class="p-2 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors"
					title={viewMode === 'threaded' ? 'Switch to flat view' : 'Switch to threaded view'}
				>
					{#if viewMode === 'threaded'}
						<svg class="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 6h16M4 12h16M4 18h7"
							/>
						</svg>
					{:else}
						<svg class="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

			<!-- Re-attach button -->
			<button
				onclick={handleAttach}
				class="p-2 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors"
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
				class="p-2 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors"
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
			<ChatView
				project={window.project}
				rootEvent={window.data?.thread}
				{onlineAgents}
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
		{:else if window.type === 'agent'}
			<div class="p-4">
				<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Agent: {window.data?.agentName}</h3>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-2">Agent details coming soon...</p>
			</div>
		{:else}
			<div class="p-4">
				<p class="text-sm text-gray-500 dark:text-gray-400">Unknown window type: {window.type}</p>
			</div>
		{/if}
	</div>

	<!-- Resize Handle -->
	<div
		class="resize-handle absolute bottom-0 right-0 w-4 h-4 cursor-se-resize opacity-0 hover:opacity-100 transition-opacity"
		onmousedown={handleMouseDownResize}
		role="button"
		tabindex="-1"
		aria-label="Resize window"
	>
		<svg class="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
		</svg>
	</div>
</div>

<style>
	.detached-window {
		user-select: none;
	}

	.detached-window.dragging * {
		user-select: none;
		pointer-events: none;
	}

	.resize-handle {
		background: linear-gradient(135deg, transparent 50%, #9ca3af 50%);
	}

	:global(.dark) .resize-handle {
		background: linear-gradient(135deg, transparent 50%, #6b7280 50%);
	}
</style>
