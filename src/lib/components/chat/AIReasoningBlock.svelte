<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import { cn } from '$lib/utils/cn';
	import { Streamdown } from 'svelte-streamdown';

	interface Props {
		reasoningEvent: NDKEvent;
	}

	let { reasoningEvent }: Props = $props();

	let isOpen = $state(false);

	const reasoningContent = $derived(reasoningEvent.content || '');

	// Compute stable ID for accessibility
	const contentId = $derived(
		reasoningEvent.id
			? `reasoning-content-${reasoningEvent.id}`
			: `reasoning-content-${Date.now()}`
	);
</script>

{#if reasoningContent}
	<div class="group">
		<div class="transition-all">
			<!-- Trigger Row -->
			<button
				type="button"
				onclick={() => (isOpen = !isOpen)}
				aria-expanded={isOpen}
				aria-controls={contentId}
				class="py-1 flex items-center gap-2 text-left hover:bg-muted/50 transition-colors rounded-lg"
			>
				<svg
					class={cn(
						'w-4 h-4 transition-transform text-muted-foreground flex-shrink-0',
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

				<span class="text-sm text-muted-foreground inline-flex items-center gap-1.5">Thinking</span>
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
				</div>
			{/if}
		</div>
	</div>
{/if}
