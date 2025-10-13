<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import { cn } from '$lib/utils/cn';

	interface Props {
		event: NDKEvent;
	}

	let { event }: Props = $props();

	const toolData = $derived.by(() => {
		const toolTag = event.tags.find((tag) => tag[0] === 'tool');
		if (!toolTag) return null;

		const title = event.tagValue('tool-title');
		const name = toolTag[1];

		return {
			name: title || event.content,
			description: title && event.content ? event.content : undefined
		};
	});
</script>

{#if toolData}
	{#if toolData.name}
		<div class="flex items-center gap-2 text-sm">
			<!-- Tool Icon -->
			<svg
				class="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
				/>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
				/>
			</svg>

			<!-- Tool Content -->
			<span class="text-blue-600 dark:text-blue-400">{toolData.name}</span>
		</div>
	{:else}
		<span class="text-xs text-gray-500 dark:text-gray-400">
			{event.content}
		</span>
	{/if}
{/if}
