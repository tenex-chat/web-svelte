<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import { cn } from '$lib/utils/cn';
	import { Streamdown } from 'svelte-streamdown';

	interface Props {
		reasoningEvent: NDKEvent;
		isStreaming?: boolean;
		isLastMessage?: boolean;
	}

	let { reasoningEvent, isStreaming = false, isLastMessage = false }: Props = $props();

	let isOpen = $state(isLastMessage);

	const reasoningContent = $derived(reasoningEvent.content || '');

	// Compute stable ID for accessibility
	const contentId = $derived(
		reasoningEvent.id
			? `reasoning-content-${reasoningEvent.id}`
			: `reasoning-content-${Date.now()}`
	);
</script>

{#if reasoningContent}
	<div class="">
		<div
			class={cn(
				'transition-all',
				isStreaming
					? 'border-blue-400 bg-blue-50/50'
					: '',
				isOpen ? 'shadow-sm' : ''
			)}
		>
			<!-- Trigger Button -->
			<button
				type="button"
				onclick={() => (isOpen = !isOpen)}
				aria-expanded={isOpen}
				aria-controls={contentId}
				class="w-full py-2 flex items-center gap-2 text-left hover:bg-muted/50 transition-colors rounded-lg"
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

				<svg class="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
					/>
				</svg>

				<span class="text-sm font-medium text-foreground">AI Reasoning</span>

				{#if isStreaming}
					<span class="ml-auto flex items-center gap-1.5 text-xs text-primary">
						<span class="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
						thinking...
					</span>
				{/if}
			</button>

			<!-- Reasoning Content -->
			{#if isOpen}
				<div id={contentId} class="px-4 py-3 bg-card/50">
					<div class="prose prose-sm max-w-none dark:prose-invert text-foreground text-sm">
						<Streamdown
							content={reasoningContent}
							class="prose prose-sm max-w-none dark:prose-invert text-foreground text-sm"
							parseIncompleteMarkdown={true}
							animation={{ enabled: false }}
							baseTheme="tailwind"
							shikiTheme="github-dark-dimmed"
						/>
					</div>
					{#if isStreaming}
						<span class="inline-block w-1.5 h-4 ml-0.5 bg-primary animate-pulse"></span>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}
