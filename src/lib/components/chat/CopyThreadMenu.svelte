<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { NDKKind, type NDKEvent } from '@nostr-dev-kit/ndk';
	import type { Message } from '$lib/utils/messageProcessor';
	import { formatThreadAsMarkdown, formatThreadAsJSON, formatThreadAsJSONL } from '$lib/utils/copyThread';
	import { clickOutside } from '$lib/utils/clickOutside';

	interface Props {
		messages: Message[];
		rootEvent: NDKEvent | null;
	}

	let { messages, rootEvent }: Props = $props();

	// Subscribe to ALL thread replies for copying functionality
	const allThreadReplies = ndk.$subscribe(() =>
		rootEvent && messages.length > 0
			? {
					filters: [
						{
							kinds: [NDKKind.GenericReply],
							'#E': [rootEvent.id] // Get all events that reference this thread root
						}
					],
					closeOnEose: false
			  }
			: false
	);

	let isOpen = $state(false);
	let copiedFormat = $state<'markdown' | 'json' | 'jsonl' | null>(null);

	async function handleCopy(format: 'markdown' | 'json' | 'jsonl') {
		try {
			let content: string;
			const allEvents = allThreadReplies?.events || [];

			if (format === 'json') {
				content = await formatThreadAsJSON(messages, rootEvent, allEvents, ndk);
			} else if (format === 'jsonl') {
				content = await formatThreadAsJSONL(messages, rootEvent, allEvents);
			} else {
				content = await formatThreadAsMarkdown(messages, rootEvent, allEvents, ndk);
			}

			await navigator.clipboard.writeText(content);
			copiedFormat = format;
			setTimeout(() => {
				copiedFormat = null;
			}, 2000);
		} catch (error) {
			console.error(`Failed to copy thread as ${format}:`, error);
		}
	}

	function handleClickOutside() {
		isOpen = false;
	}
</script>

<div class="relative">
	<button
		type="button"
		onclick={() => (isOpen = !isOpen)}
		class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
		title="Copy thread"
		aria-label="Copy thread"
	>
		<svg class="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
			/>
		</svg>
	</button>

	{#if isOpen}
		<div
			use:clickOutside={handleClickOutside}
			class="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 rounded-lg shadow-lg overflow-hidden z-50"
		>
			<!-- Markdown Option -->
			<button
				type="button"
				onclick={() => handleCopy('markdown')}
				class="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors text-left text-sm"
			>
				<svg class="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
					/>
				</svg>
				<span class="flex-1 text-gray-900 dark:text-gray-100">Copy as Markdown</span>
				{#if copiedFormat === 'markdown'}
					<svg class="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
					</svg>
				{/if}
			</button>

			<!-- JSON Option -->
			<button
				type="button"
				onclick={() => handleCopy('json')}
				class="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors text-left text-sm"
			>
				<svg class="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
					/>
				</svg>
				<span class="flex-1 text-gray-900 dark:text-gray-100">Copy as JSON</span>
				{#if copiedFormat === 'json'}
					<svg class="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
					</svg>
				{/if}
			</button>

			<!-- JSONL Option -->
			<button
				type="button"
				onclick={() => handleCopy('jsonl')}
				class="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors text-left text-sm"
			>
				<svg class="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
					/>
				</svg>
				<span class="flex-1 text-gray-900 dark:text-gray-100">Copy as JSONL</span>
				{#if copiedFormat === 'jsonl'}
					<svg class="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
					</svg>
				{/if}
			</button>
		</div>
	{/if}
</div>
