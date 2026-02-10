<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import type { NDKProject } from '$lib/events/NDKProject';
	import { ndk } from '$lib/ndk.svelte';
	import { projectStatusStore } from '$lib/stores/projectStatus.svelte';
	import { conversationMetadataStore } from '$lib/stores/conversationMetadata.svelte';
	import { isRootThread, sortByActivity, buildThreadMetadata } from '$lib/stores/threadStore.svelte';
	import ChatView from '$lib/components/chat/ChatView.svelte';
	import ThreadListItem from '$lib/components/chat/ThreadListItem.svelte';
	import { MessageSquare, Plus, X, ArrowLeft } from 'lucide-svelte';
	import { storage } from '$lib/utils/storage.svelte';

	interface Props {
		document: NDKEvent;
		project?: NDKProject;
		onClose?: () => void;
	}

	let { document, project, onClose }: Props = $props();

	// Resize state
	const DEFAULT_WIDTH_PERCENT = 35;
	const MIN_WIDTH_PERCENT = 20;
	const MAX_WIDTH_PERCENT = 60;

	let widthPercent = $state(DEFAULT_WIDTH_PERCENT);
	let isResizing = $state(false);
	let sidebarElement: HTMLDivElement;

	// Load persisted width on mount (run once)
	let hasLoadedWidth = false;
	$effect(() => {
		if (hasLoadedWidth) return;
		hasLoadedWidth = true;
		const stored = storage.get('doc-chat-sidebar-width');
		if (stored && stored >= MIN_WIDTH_PERCENT && stored <= MAX_WIDTH_PERCENT) {
			widthPercent = stored;
		}
	});

	function handleResizeStart(e: MouseEvent) {
		e.preventDefault();
		isResizing = true;

		const handleMouseMove = (e: MouseEvent) => {
			if (!isResizing || !sidebarElement) return;

			// Get the parent container (DocumentView flex container)
			const parent = sidebarElement.parentElement;
			if (!parent) return;

			const parentRect = parent.getBoundingClientRect();
			const distanceFromRight = parentRect.right - e.clientX;
			let newWidthPercent = (distanceFromRight / parentRect.width) * 100;

			newWidthPercent = Math.max(MIN_WIDTH_PERCENT, Math.min(MAX_WIDTH_PERCENT, newWidthPercent));
			widthPercent = newWidthPercent;
		};

		const handleMouseUp = () => {
			if (isResizing) {
				isResizing = false;
				storage.set('doc-chat-sidebar-width', widthPercent);
			}
			window.removeEventListener('mousemove', handleMouseMove);
			window.removeEventListener('mouseup', handleMouseUp);
		};

		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', handleMouseUp);
	}

	// State
	let selectedThread = $state<NDKEvent | null>(null);
	let showNewConversation = $state(false);

	// Document tag reference for creating new threads - cache the string value
	// to avoid re-triggering subscriptions when document object changes
	let cachedDocumentTagId = $state<string | undefined>(undefined);

	$effect(() => {
		const newTagId = document.tagId();
		// Only update if the string value actually changed
		if (newTagId !== cachedDocumentTagId) {
			cachedDocumentTagId = newTagId;
		}
	});

	// Use the cached tag ID for the subscription to ensure stability
	const documentTagId = $derived(cachedDocumentTagId);

	// Subscribe to threads: all conversations about this document
	const threadsSubscription = ndk.$subscribe<NDKEvent>(() => {
		if (!documentTagId) return { filters: [] };
		return {
			filters: [{
				kinds: [1],
				'#a': [documentTagId]
			}],
			closeOnEose: false
		};
	});

	// Threads and metadata - computed from subscription events
	const threadMetadata = $derived.by(() => {
		const events = threadsSubscription.events as NDKEvent[];
		const rootThreads = events.filter(isRootThread);
		const replies = events.filter(e => !isRootThread(e));
		return buildThreadMetadata(rootThreads, replies);
	});

	const threads = $derived.by(() => {
		const events = threadsSubscription.events as NDKEvent[];
		const rootThreads = events.filter(isRootThread);
		return sortByActivity(rootThreads, threadMetadata);
	});

	// Get project agents from status store, with document author first
	const projectId = $derived(project?.tagId());
	const onlineAgents = $derived.by(() => {
		if (!projectId) return [];
		const agents = projectStatusStore.getOnlineAgents(projectId);
		// Sort so document author is first (default agent)
		return [...agents].sort((a, b) => {
			if (a.pubkey === document.pubkey) return -1;
			if (b.pubkey === document.pubkey) return 1;
			return 0;
		});
	});

	// Handle thread creation
	function handleThreadCreated(thread: NDKEvent) {
		selectedThread = thread;
		showNewConversation = false;
	}

	function handleThreadSelect(thread: NDKEvent) {
		selectedThread = thread;
		showNewConversation = false;
	}

	function isSelected(thread: NDKEvent): boolean {
		return selectedThread !== null && selectedThread.id === thread.id;
	}

	function handleNewConversation() {
		selectedThread = null;
		showNewConversation = true;
	}

	function handleBack() {
		selectedThread = null;
		showNewConversation = false;
	}
</script>

<div
	bind:this={sidebarElement}
	class="flex flex-col bg-card h-full border-l border-border relative"
	style="width: {widthPercent}%; {isResizing ? 'user-select: none;' : ''}"
>
	<!-- Resize Handle -->
	<div
		class="resize-handle absolute top-0 left-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-500/50 transition-colors z-10"
		onmousedown={handleResizeStart}
		role="separator"
		aria-label="Resize sidebar"
		aria-orientation="vertical"
	></div>
	<!-- Header -->
	<div class="border-b border-border px-3 py-2 flex items-center gap-2">
		{#if selectedThread || showNewConversation}
			<button
				onclick={handleBack}
				class="p-1.5 rounded hover:bg-muted transition-colors"
				aria-label="Back to threads"
			>
				<ArrowLeft class="h-4 w-4" />
			</button>
			<span class="text-sm font-medium flex-1">
				{showNewConversation ? 'New Discussion' : 'Discussion'}
			</span>
		{:else}
			<MessageSquare class="h-4 w-4 text-muted-foreground" />
			<span class="text-sm font-medium flex-1">Discussions</span>
			<button
				onclick={handleNewConversation}
				class="p-1.5 rounded hover:bg-muted transition-colors"
				aria-label="Start new discussion"
			>
				<Plus class="h-4 w-4" />
			</button>
		{/if}
		<button
			onclick={onClose}
			class="p-1.5 rounded hover:bg-muted transition-colors"
			aria-label="Close sidebar"
		>
			<X class="h-4 w-4" />
		</button>
	</div>

	<!-- Content -->
	<div class="flex-1 overflow-hidden">
		{#if selectedThread || showNewConversation}
			<ChatView
				{project}
				rootEvent={selectedThread}
				{onlineAgents}
				onThreadCreated={handleThreadCreated}
				hideHeader={true}
				documentRef={documentTagId}
			/>
		{:else}
			<!-- Thread List -->
			<div class="overflow-y-auto h-full">
				{#if threads.length === 0}
					<div class="flex flex-col items-center justify-center h-full p-6 text-center">
						<MessageSquare class="h-12 w-12 text-muted-foreground mb-3" />
						<p class="text-sm font-medium">No discussions yet</p>
						<p class="text-xs text-muted-foreground mt-1">
							Start a conversation about this document
						</p>
						<button
							onclick={handleNewConversation}
							class="mt-4 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
						>
							Start Discussion
						</button>
					</div>
				{:else}
					{#each threads as thread}
						<ThreadListItem
							{thread}
							isSelected={isSelected(thread)}
							{conversationMetadataStore}
							{threadMetadata}
							onclick={() => handleThreadSelect(thread)}
						/>
					{/each}
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.resize-handle:active {
		background-color: rgb(59 130 246 / 0.7);
	}
</style>
