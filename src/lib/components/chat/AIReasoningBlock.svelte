<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import { cn } from '$lib/utils/cn';
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';
	import { dev } from '$app/environment';

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

	// Helper function to escape HTML and convert newlines to <br>
	function escapeAndPreserveNewlines(text: string): string {
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;')
			.replace(/\n/g, '<br>');
	}

	// Render markdown with sanitization - optimized for streaming
	const renderedReasoningContent = $derived.by(() => {
		// During streaming, use plain-text fallback to avoid re-parsing markdown on every character
		if (isStreaming) {
			const escapedHtml = escapeAndPreserveNewlines(reasoningContent);
			return DOMPurify.sanitize(escapedHtml);
		}

		// When finalized, parse markdown
		try {
			const rawHtml = marked.parse(reasoningContent) as string;
			return DOMPurify.sanitize(rawHtml);
		} catch (error) {
			// Log error in dev mode and fallback to escaped plain-text
			if (dev) {
				console.warn('[AIReasoningBlock] Markdown parsing failed:', error);
			}
			const escapedHtml = escapeAndPreserveNewlines(reasoningContent);
			return DOMPurify.sanitize(escapedHtml);
		}
	});
</script>

{#if reasoningContent}
	<div class="my-2">
		<div
			class={cn(
				'border rounded-lg transition-all',
				isStreaming
					? 'border-blue-400 bg-blue-50/50'
					: 'border-border bg-muted',
				isOpen ? 'shadow-sm' : ''
			)}
		>
			<!-- Trigger Button -->
			<button
				type="button"
				onclick={() => (isOpen = !isOpen)}
				aria-expanded={isOpen}
				aria-controls={contentId}
				class="w-full px-4 py-2 flex items-center gap-2 text-left hover:bg-muted/50 transition-colors rounded-lg"
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
				<div id={contentId} class="px-4 py-3 border-t border-border bg-card/50">
					<div class="prose prose-sm max-w-none dark:prose-invert text-foreground">
						{@html renderedReasoningContent}
					</div>
					{#if isStreaming}
						<span class="inline-block w-1.5 h-4 ml-0.5 bg-primary animate-pulse"></span>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}
