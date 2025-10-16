<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import { cn } from '$lib/utils/cn';

	interface Props {
		reasoningEvent: NDKEvent;
		isStreaming?: boolean;
		isLastMessage?: boolean;
	}

	let { reasoningEvent, isStreaming = false, isLastMessage = false }: Props = $props();

	let isOpen = $state(isLastMessage);

	const reasoningContent = $derived(reasoningEvent.content || '');
</script>

{#if reasoningContent}
	<div class="my-2">
		<div
			class={cn(
				'border rounded-lg transition-all',
				isStreaming
					? 'border-blue-400 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-900/20'
					: 'border-border bg-muted dark:bg-zinc-800/50',
				isOpen ? 'shadow-sm' : ''
			)}
		>
			<!-- Trigger Button -->
			<button
				onclick={() => (isOpen = !isOpen)}
				class="w-full px-4 py-2 flex items-center gap-2 text-left hover:bg-muted/50 dark:hover:bg-zinc-700/50 transition-colors rounded-lg"
			>
				<svg
					class={cn(
						'w-4 h-4 transition-transform text-muted-foreground',
						isOpen ? 'rotate-90' : ''
					)}
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 5l7 7-7 7"
					/>
				</svg>

				<svg class="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
					/>
				</svg>

				<span class="text-sm font-medium text-foreground">AI Reasoning</span>

				{#if isStreaming}
					<span class="ml-auto flex items-center gap-1.5 text-xs text-primary dark:text-blue-400">
						<span class="inline-block w-1.5 h-1.5 rounded-full bg-primary dark:bg-blue-400 animate-pulse"></span>
						thinking...
					</span>
				{/if}
			</button>

			<!-- Reasoning Content -->
			{#if isOpen}
				<div class="px-4 py-3 border-t border-border bg-white/50 dark:bg-zinc-900/50">
					<div class="prose prose-sm max-w-none dark:prose-invert text-foreground whitespace-pre-wrap">
						{reasoningContent}
						{#if isStreaming}
							<span class="inline-block w-1.5 h-4 ml-0.5 bg-primary dark:bg-blue-400 animate-pulse"></span>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}
