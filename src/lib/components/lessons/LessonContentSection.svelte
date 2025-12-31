<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';

	interface Props {
		/** Section title */
		title: string;
		/** Section content text (can contain markdown) */
		content: string;
		/** Icon component to display (lucide-svelte or similar) */
		icon?: any;
		/** Icon color class (e.g., 'text-blue-500') */
		iconColor?: string;
		/** Use muted text color for content */
		muted?: boolean;
		/** Render content as markdown (default: true) */
		markdown?: boolean;
		/** Custom icon slot (takes precedence over icon prop) */
		iconSlot?: Snippet;
	}

	let {
		title,
		content,
		icon: Icon,
		iconColor = 'text-muted-foreground',
		muted = false,
		markdown = true,
		iconSlot
	}: Props = $props();

	// Prose styling for markdown content
	const proseClasses = `prose prose-neutral dark:prose-invert max-w-none
		prose-headings:font-semibold
		prose-h1:text-xl prose-h1:mb-3
		prose-h2:text-lg prose-h2:mb-2
		prose-h3:text-base prose-h3:mb-2
		prose-p:mb-3 prose-p:leading-relaxed
		prose-a:text-primary dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
		prose-code:bg-muted dark:prose-code:bg-zinc-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
		prose-pre:bg-muted dark:prose-pre:bg-zinc-800 prose-pre:p-4 prose-pre:rounded-lg
		prose-ul:list-disc prose-ul:pl-6 prose-ul:mb-3
		prose-ol:list-decimal prose-ol:pl-6 prose-ol:mb-3
		prose-li:mb-1
		prose-blockquote:border-l-4 prose-blockquote:border-border dark:prose-blockquote:border-zinc-600 prose-blockquote:pl-4 prose-blockquote:italic`;

	/**
	 * Renders markdown content with sanitization.
	 */
	function renderMarkdown(text: string): string {
		try {
			const rawHtml = marked.parse(text || '') as string;
			return DOMPurify.sanitize(rawHtml);
		} catch {
			return text || '';
		}
	}

	const renderedContent = $derived(markdown ? renderMarkdown(content) : content);
</script>

<section class="bg-muted/50 rounded-lg p-4">
	<header class="flex items-center gap-2 mb-3">
		{#if iconSlot}
			{@render iconSlot()}
		{:else if Icon}
			<Icon class={cn('h-5 w-5', iconColor)} />
		{/if}
		<h3 class="font-semibold text-foreground">{title}</h3>
	</header>

	{#if markdown}
		<div class={proseClasses}>
			{@html renderedContent}
		</div>
	{:else}
		<p class={cn('leading-relaxed whitespace-pre-wrap', muted ? 'text-muted-foreground' : 'text-foreground')}>
			{content}
		</p>
	{/if}
</section>
