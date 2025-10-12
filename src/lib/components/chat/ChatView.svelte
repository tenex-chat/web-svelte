<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import type { NDKProject } from '$lib/events/NDKProject';
	import type { ProjectAgent } from '$lib/events/NDKProjectStatus';
	import type { ThreadViewMode } from '$lib/utils/messageProcessor';
	import MessageList from './MessageList.svelte';
	import ChatInput from './ChatInput.svelte';

	interface Props {
		project?: NDKProject;
		rootEvent?: NDKEvent | null;
		onlineAgents?: ProjectAgent[];
		onThreadCreated?: (thread: NDKEvent) => void;
	}

	let { project, rootEvent = null, onlineAgents = [], onThreadCreated }: Props = $props();

	let localRootEvent = $state<NDKEvent | null>(rootEvent);
	let viewMode = $state<ThreadViewMode>('threaded');

	// Update local root when prop changes
	$effect(() => {
		if (rootEvent) {
			localRootEvent = rootEvent;
		}
	});

	function handleThreadCreated(thread: NDKEvent) {
		localRootEvent = thread;
		if (onThreadCreated) {
			onThreadCreated(thread);
		}
	}

	function toggleViewMode() {
		viewMode = viewMode === 'threaded' ? 'flattened' : 'threaded';
	}
</script>

<div class="flex flex-col h-full">
	{#if localRootEvent}
		<!-- Chat Header -->
		<div class="border-b border-gray-200 px-4 py-3 bg-white">
			<div class="flex items-center justify-between">
				<span class="text-sm font-medium text-gray-900">
					{localRootEvent.tagValue('title') || 'Conversation'}
				</span>

				<!-- View Mode Toggle -->
				<button
					onclick={toggleViewMode}
					class="flex items-center gap-1.5 px-2 py-1 text-xs rounded hover:bg-gray-100 transition-colors"
					title="Toggle view mode"
				>
					{#if viewMode === 'threaded'}
						<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 6h16M4 12h16M4 18h7"
							/>
						</svg>
						<span class="text-gray-600">Threaded</span>
					{:else}
						<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 6h16M4 12h16M4 18h16"
							/>
						</svg>
						<span class="text-gray-600">Flat</span>
					{/if}
				</button>
			</div>
		</div>

		<!-- Messages -->
		<MessageList rootEvent={localRootEvent} {viewMode} />

		<!-- Input -->
		<ChatInput
			{project}
			rootEvent={localRootEvent}
			{onlineAgents}
			onThreadCreated={handleThreadCreated}
		/>
	{:else}
		<!-- New Conversation -->
		<div class="flex-1 flex items-center justify-center text-gray-500">
			Start a new conversation
		</div>

		<ChatInput {project} {onlineAgents} onThreadCreated={handleThreadCreated} />
	{/if}
</div>
