<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import { cn } from '$lib/utils/cn';

	interface Props {
		event: NDKEvent;
		onSuggestionClick: (suggestion: string, index: number) => void;
		class?: string;
		isMobile?: boolean;
	}

	let { event, onSuggestionClick, class: className, isMobile = false }: Props = $props();

	// Extract suggestion tags from the event
	const suggestions = $derived(
		event.tags
			?.filter((tag) => tag[0] === 'suggestion')
			?.map((tag) => tag[1])
			?.filter(Boolean) || []
	);
</script>

{#if suggestions.length > 0}
	<div
		class={cn(
			'flex flex-wrap gap-2 mt-3 p-3 bg-muted rounded-lg border border-border',
			isMobile && 'gap-1.5 p-2',
			className
		)}
	>
		<div class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1 w-full">
			<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
				/>
			</svg>
			<span>Suggested responses:</span>
		</div>
		{#each suggestions as suggestion, index (`${event.id}-suggestion-${index}`)}
			<button
				type="button"
				onclick={() => onSuggestionClick(suggestion, index)}
				class={cn(
					'group relative transition-all hover:bg-blue-50 hover:border-blue-500',
					'flex items-center gap-2 px-3 py-2 border border-border rounded-md',
					isMobile && 'text-xs px-2.5 py-1.5'
				)}
			>
				<span class="flex-1 text-left">{suggestion}</span>
				<svg
					class="h-3 w-3 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M14 5l7 7m0 0l-7 7m7-7H3"
					/>
				</svg>
			</button>
		{/each}
	</div>
{/if}
