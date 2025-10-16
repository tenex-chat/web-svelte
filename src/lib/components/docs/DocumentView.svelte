<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import type { NDKProject } from '$lib/events/NDKProject';
	import { ndk } from '$lib/ndk.svelte';
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';
	import { Avatar } from '@nostr-dev-kit/svelte';
	import { Clock, Hash, ArrowLeft, Copy } from 'lucide-svelte';
	import { formatRelativeTime } from '$lib/utils/time';

	interface Props {
		document: NDKEvent;
		project?: NDKProject;
		onBack?: () => void;
	}

	let { document, project, onBack }: Props = $props();

	// Fetch author profile
	const profile = ndk.$fetchProfile(() => document.pubkey);

	const authorName = $derived(
		profile?.displayName ||
			profile?.name ||
			document.pubkey.slice(0, 8) + '...' + document.pubkey.slice(-4)
	);

	// Get document metadata
	const title = $derived(document.tagValue('title') || 'Untitled');
	const summary = $derived(document.tagValue('summary') || '');

	// Get hashtags
	const hashtags = $derived(
		document.tags
			.filter((tag) => tag[0] === 't' && tag[1])
			.map((tag) => tag[1])
	);

	// Calculate reading time
	function calculateReadingTime(content: string): string {
		if (!content) return '1 min';
		const wordsPerMinute = 200;
		const words = content.trim().split(/\s+/).length;
		const minutes = Math.ceil(words / wordsPerMinute);
		return `${minutes} min read`;
	}

	const readingTime = $derived(calculateReadingTime(document.content || ''));

	// Render markdown with sanitization
	const renderedContent = $derived.by(() => {
		try {
			const rawHtml = marked(document.content || '');
			return DOMPurify.sanitize(rawHtml);
		} catch {
			return document.content || '';
		}
	});

	async function handleCopyLink() {
		try {
			const encoded = document.encode();
			await navigator.clipboard.writeText(encoded);
		} catch (error) {
			console.error('Failed to copy link:', error);
		}
	}
</script>

<div class="h-full flex flex-col bg-white dark:bg-zinc-900">
	<!-- Header -->
	<div class="border-b border-gray-200 dark:border-zinc-700 px-4 py-3">
		<div class="flex items-center gap-3">
			{#if onBack}
				<button
					type="button"
					onclick={onBack}
					class="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
					aria-label="Go back"
				>
					<ArrowLeft class="h-4 w-4" />
				</button>
			{/if}
			<div class="flex-1 min-w-0">
				<h2 class="text-lg font-semibold truncate">{title}</h2>
				{#if project}
					<p class="text-xs text-gray-500 dark:text-gray-400 truncate">{project.title}</p>
				{/if}
			</div>
			<button
				type="button"
				onclick={handleCopyLink}
				class="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
				aria-label="Copy link"
			>
				<Copy class="h-4 w-4" />
			</button>
		</div>
	</div>

	<!-- Content -->
	<div class="flex-1 overflow-y-auto">
		<div class="max-w-3xl mx-auto px-6 py-6">
			<!-- Metadata Section -->
			<div class="mb-6 pb-6 border-b border-gray-200 dark:border-zinc-700">
				<!-- Author -->
				<div class="flex items-center gap-3 mb-3">
					<Avatar {ndk} pubkey={document.pubkey} size={40} />
					<div>
						<div class="font-medium text-sm">{authorName}</div>
						<div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
							<Clock class="h-3 w-3" />
							<span>{formatRelativeTime(document.created_at || 0)} · {readingTime}</span>
						</div>
					</div>
				</div>

				<!-- Summary -->
				{#if summary}
					<p class="text-sm text-gray-600 dark:text-gray-400 mb-3">{summary}</p>
				{/if}

				<!-- Tags -->
				{#if hashtags.length > 0}
					<div class="flex items-center gap-2 flex-wrap">
						{#each hashtags as tag}
							<div
								class="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded"
							>
								<Hash class="h-3 w-3" />
								<span>{tag}</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Article Content -->
			<div
				class="prose prose-neutral dark:prose-invert max-w-none
				       prose-headings:font-semibold
				       prose-h1:text-2xl prose-h1:mb-4
				       prose-h2:text-xl prose-h2:mb-3
				       prose-h3:text-lg prose-h3:mb-2
				       prose-p:mb-4 prose-p:leading-relaxed
				       prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
				       prose-code:bg-gray-100 dark:prose-code:bg-zinc-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
				       prose-pre:bg-gray-100 dark:prose-pre:bg-zinc-800 prose-pre:p-4 prose-pre:rounded-lg
				       prose-ul:list-disc prose-ul:pl-6 prose-ul:mb-4
				       prose-ol:list-decimal prose-ol:pl-6 prose-ol:mb-4
				       prose-li:mb-1
				       prose-blockquote:border-l-4 prose-blockquote:border-gray-300 dark:prose-blockquote:border-zinc-600 prose-blockquote:pl-4 prose-blockquote:italic
				       prose-img:rounded-lg prose-img:shadow-md"
			>
				{@html renderedContent}
			</div>
		</div>
	</div>
</div>
