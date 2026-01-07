<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import type { NDKProject } from '$lib/events/NDKProject';
	import { ndk } from '$lib/ndk.svelte';
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';
	import { User } from '$lib/ndk/ui/user';
	import { Clock, Hash, ArrowLeft, Copy, MessageSquare, FileText, FileDiff } from 'lucide-svelte';
	import { formatRelativeTime } from '$lib/utils/time';
	import DocumentChatSidebar from './DocumentChatSidebar.svelte';
	import { Streamdown } from 'svelte-streamdown';

	interface Props {
		document: NDKEvent;
		project?: NDKProject;
		onBack?: () => void;
		hideHeader?: boolean;
		sidebarOpen?: boolean;
	}

	let { document = $bindable(), project, onBack, hideHeader = false, sidebarOpen = $bindable(false) }: Props = $props();

	// Animation state for version transitions
	let isTransitioning = $state(false);
	let pendingDocument: NDKEvent | null = $state(null);
	let previousEventId = $state(document.id);

	// Version history for diff view (session-only storage)
	let previousVersion: NDKEvent | null = $state(null);
	type ViewMode = 'current' | 'changes';
	let viewMode = $state<ViewMode>('current');

	// Subscribe to document updates for live refresh
	$effect(() => {
		const dTag = document.tagValue('d');
		if (!dTag || !ndk) return;

		const sub = ndk.subscribe(
			{
				kinds: [30023],
				authors: [document.pubkey],
				'#d': [dTag]
			},
			{ closeOnEose: false }
		);

		sub.on('event', (event: NDKEvent) => {
			if (event.created_at && event.created_at > (document.created_at || 0)) {
				// New version detected - trigger fade transition
				if (event.id !== previousEventId) {
					pendingDocument = event;
					isTransitioning = true;

					// After fade-out, swap the document and fade-in
					setTimeout(() => {
						// Store current version as previous before updating
						previousVersion = document;
						document = pendingDocument!;
						previousEventId = event.id;
						pendingDocument = null;
						isTransitioning = false;
					}, 200); // Match the CSS transition duration
				} else {
					document = event;
				}
			}
		});

		return () => sub.stop();
	});


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
			const rawHtml = marked.parse(document.content || '') as string;
			return DOMPurify.sanitize(rawHtml);
		} catch {
			return document.content || '';
		}
	});

	// Generate unified diff for changes view
	const diffContent = $derived.by(() => {
		if (!previousVersion) return '';

		const oldLines = (previousVersion.content || '').split('\n');
		const newLines = (document.content || '').split('\n');

		// Simple line-by-line diff algorithm
		const diff: string[] = [];
		let oldIndex = 0;
		let newIndex = 0;

		while (oldIndex < oldLines.length || newIndex < newLines.length) {
			const oldLine = oldLines[oldIndex];
			const newLine = newLines[newIndex];

			if (oldIndex >= oldLines.length) {
				// Remaining new lines are additions
				diff.push(`+ ${newLine}`);
				newIndex++;
			} else if (newIndex >= newLines.length) {
				// Remaining old lines are deletions
				diff.push(`- ${oldLine}`);
				oldIndex++;
			} else if (oldLine === newLine) {
				// Lines match - no change
				diff.push(`  ${oldLine}`);
				oldIndex++;
				newIndex++;
			} else {
				// Lines differ - look ahead to find if it's an insert, delete, or modify
				const oldInNew = newLines.indexOf(oldLine, newIndex);
				const newInOld = oldLines.indexOf(newLine, oldIndex);

				if (oldInNew !== -1 && (newInOld === -1 || oldInNew - newIndex <= newInOld - oldIndex)) {
					// Old line found later in new - lines were inserted
					diff.push(`+ ${newLine}`);
					newIndex++;
				} else if (newInOld !== -1) {
					// New line found later in old - lines were deleted
					diff.push(`- ${oldLine}`);
					oldIndex++;
				} else {
					// Line was modified
					diff.push(`- ${oldLine}`);
					diff.push(`+ ${newLine}`);
					oldIndex++;
					newIndex++;
				}
			}
		}

		return '```diff\n' + diff.join('\n') + '\n```';
	});

	// Check if there are changes to show
	const hasChanges = $derived(previousVersion !== null);

	async function handleCopyLink() {
		try {
			const encoded = document.encode();
			await navigator.clipboard.writeText(encoded);
		} catch (error) {
			console.error('Failed to copy link:', error);
		}
	}
</script>

<div class="h-full flex bg-card">
	<!-- Document Content Column -->
	<div class="flex-1 flex flex-col overflow-hidden">
		<!-- Header -->
		{#if !hideHeader}
		<div class="border-b border-border px-4 py-3">
		<div class="flex items-center gap-3">
			{#if onBack}
				<button
					type="button"
					onclick={onBack}
					class="p-1.5 rounded hover:bg-muted transition-colors"
					aria-label="Go back"
				>
					<ArrowLeft class="h-4 w-4" />
				</button>
			{/if}
			<div class="flex-1 min-w-0">
				<h2 class="text-lg font-semibold truncate">{title}</h2>
				{#if project}
					<p class="text-xs text-muted-foreground truncate">{project.title}</p>
				{/if}
			</div>
			<!-- View mode toggle (only show when there are changes) -->
			{#if hasChanges}
				<div class="flex items-center gap-1 bg-muted rounded-lg p-0.5">
					<button
						type="button"
						onclick={() => viewMode = 'current'}
						class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors {viewMode === 'current' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
						aria-label="View current version"
					>
						<FileText class="h-3.5 w-3.5" />
						<span>Current</span>
					</button>
					<button
						type="button"
						onclick={() => viewMode = 'changes'}
						class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors {viewMode === 'changes' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
						aria-label="View changes from previous version"
					>
						<FileDiff class="h-3.5 w-3.5" />
						<span>Changes</span>
					</button>
				</div>
			{/if}
			<button
				type="button"
				onclick={() => sidebarOpen = !sidebarOpen}
				class="p-1.5 rounded hover:bg-muted transition-colors"
				aria-label={sidebarOpen ? "Close chat sidebar" : "Open chat sidebar"}
			>
				<MessageSquare class="h-4 w-4" />
			</button>
			<button
				type="button"
				onclick={handleCopyLink}
				class="p-1.5 rounded hover:bg-muted transition-colors"
				aria-label="Copy link"
			>
				<Copy class="h-4 w-4" />
			</button>
		</div>
	</div>
	{/if}

	<!-- Content -->
	<div class="flex-1 overflow-y-auto">
		<div
			class="max-w-3xl mx-auto px-6 py-6 transition-opacity duration-200 ease-in-out"
			class:opacity-0={isTransitioning}
			class:opacity-100={!isTransitioning}
		>
			<!-- View mode toggle (shown when header is hidden and there are changes) -->
			{#if hideHeader && hasChanges}
				<div class="flex items-center justify-end gap-1 mb-4">
					<div class="flex items-center gap-1 bg-muted rounded-lg p-0.5">
						<button
							type="button"
							onclick={() => viewMode = 'current'}
							class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors {viewMode === 'current' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
							aria-label="View current version"
						>
							<FileText class="h-3.5 w-3.5" />
							<span>Current</span>
						</button>
						<button
							type="button"
							onclick={() => viewMode = 'changes'}
							class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors {viewMode === 'changes' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
							aria-label="View changes from previous version"
						>
							<FileDiff class="h-3.5 w-3.5" />
							<span>Changes</span>
						</button>
					</div>
				</div>
			{/if}

			<!-- Metadata Section -->
			<div class="mb-6 pb-6 border-b border-border">
				<!-- Author -->
				<User.Root {ndk} pubkey={document.pubkey}>
					<div class="flex items-center gap-3 mb-3">
						<User.Avatar class="w-10 h-10" />
						<div>
							<div class="font-medium text-sm"><User.Name /></div>
							<div class="flex items-center gap-2 text-xs text-muted-foreground">
								<Clock class="h-3 w-3" />
								<span>{formatRelativeTime(document.created_at || 0)} · {readingTime}</span>
							</div>
						</div>
					</div>
				</User.Root>

				<!-- Summary -->
				{#if summary}
					<p class="text-sm text-muted-foreground mb-3">{summary}</p>
				{/if}

				<!-- Tags -->
				{#if hashtags.length > 0}
					<div class="flex items-center gap-2 flex-wrap">
						{#each hashtags as tag}
							<div
								class="inline-flex items-center gap-1 px-2 py-1 text-xs bg-muted text-foreground rounded"
							>
								<Hash class="h-3 w-3" />
								<span>{tag}</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Article Content or Diff View -->
			{#if viewMode === 'changes' && hasChanges}
				<!-- Diff View -->
				<div class="rounded-lg border border-border overflow-hidden">
					<div class="bg-muted/50 px-4 py-2 border-b border-border">
						<div class="flex items-center justify-between text-xs text-muted-foreground">
							<span>Changes from previous version</span>
							<span>{formatRelativeTime(previousVersion?.created_at || 0)} → {formatRelativeTime(document.created_at || 0)}</span>
						</div>
					</div>
					<div class="p-4 overflow-x-auto">
						<Streamdown
							content={diffContent}
							class="prose prose-sm max-w-none dark:prose-invert text-foreground"
							baseTheme="shadcn"
							shikiTheme="github-dark-dimmed"
						/>
					</div>
				</div>
			{:else}
				<!-- Current Version View -->
				<div
					class="prose prose-neutral dark:prose-invert max-w-none
					       prose-headings:font-semibold
					       prose-h1:text-2xl prose-h1:mb-4
					       prose-h2:text-xl prose-h2:mb-3
					       prose-h3:text-lg prose-h3:mb-2
					       prose-p:mb-4 prose-p:leading-relaxed
					       prose-a:text-primary dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
					       prose-code:bg-muted dark:prose-code:bg-zinc-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
					       prose-pre:bg-muted dark:prose-pre:bg-zinc-800 prose-pre:p-4 prose-pre:rounded-lg
					       prose-ul:list-disc prose-ul:pl-6 prose-ul:mb-4
					       prose-ol:list-decimal prose-ol:pl-6 prose-ol:mb-4
					       prose-li:mb-1
					       prose-blockquote:border-l-4 prose-blockquote:border-border dark:prose-blockquote:border-zinc-600 prose-blockquote:pl-4 prose-blockquote:italic
					       prose-img:rounded-lg prose-img:shadow-md"
				>
					{@html renderedContent}
				</div>
			{/if}
		</div>
	</div>
	</div>

	<!-- Chat Sidebar -->
	{#if sidebarOpen}
		<DocumentChatSidebar
			{document}
			{project}
			onClose={() => sidebarOpen = false}
		/>
	{/if}
</div>
