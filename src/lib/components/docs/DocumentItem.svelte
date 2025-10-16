<script lang="ts">
	import { Clock, Hash } from 'lucide-svelte';
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import { Avatar } from '@nostr-dev-kit/svelte';
	import { ndk } from '$lib/ndk.svelte';
	import { formatRelativeTime } from '$lib/utils/time';

	interface Props {
		document: NDKEvent;
		onclick?: () => void;
	}

	let { document, onclick }: Props = $props();

	// Get document metadata
	const title = $derived(document.tagValue('title') || 'Untitled');
	const summary = $derived(document.tagValue('summary') || '');

	// Get hashtags (limit to 3)
	const hashtags = $derived(
		document.tags
			.filter((tag) => tag[0] === 't' && tag[1])
			.map((tag) => tag[1])
			.slice(0, 3)
	);

	// Calculate reading time
	function getReadingTime(content?: string): string {
		if (!content) return '1 min';
		const wordsPerMinute = 200;
		const words = content.trim().split(/\s+/).length;
		const minutes = Math.ceil(words / wordsPerMinute);
		return `${minutes} min`;
	}

	const readingTime = $derived(getReadingTime(document.content));
</script>

<button
	type="button"
	class="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors border-b text-left"
	onclick={onclick}
>
	<!-- Author Avatar -->
	<Avatar {ndk} pubkey={document.pubkey} size={32} class="shrink-0" />

	<!-- Content -->
	<div class="flex-1 min-w-0">
		<!-- Title -->
		<div class="font-medium text-sm truncate">
			{title}
		</div>

		<!-- Summary -->
		{#if summary}
			<div class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
				{summary}
			</div>
		{/if}

		<!-- Hashtags -->
		{#if hashtags.length > 0}
			<div class="flex items-center gap-1 mt-1 flex-wrap">
				{#each hashtags as tag (tag)}
					<div
						class="inline-flex items-center gap-0.5 px-1.5 h-5 text-[10px] bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 rounded"
					>
						<Hash class="h-2.5 w-2.5" />
						<span>{tag}</span>
					</div>
				{/each}
			</div>
		{/if}

		<!-- Metadata: Author, Time, Reading Time -->
		<div class="flex items-center gap-2 mt-1">
			<Clock class="h-3 w-3 text-gray-400" />
			<span class="text-xs text-gray-500 dark:text-gray-400">
				{formatRelativeTime(document.created_at || 0)} · {readingTime}
			</span>
		</div>
	</div>
</button>
