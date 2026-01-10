<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import type { NDKProject } from '$lib/events/NDKProject';
	import { ndk } from '$lib/ndk.svelte';
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';
	import { User } from '$lib/ndk/ui/user';
	import { Clock, Hash, ArrowLeft, Copy, MessageSquare, FileText, FileDiff, ChevronDown } from 'lucide-svelte';
	import { formatRelativeTime } from '$lib/utils/time';
	import DocumentChatSidebar from './DocumentChatSidebar.svelte';
	import { Streamdown } from 'svelte-streamdown';
	import { reportsStore } from '$lib/stores/reports.svelte';

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

	// Version history for diff view
	type ViewMode = 'current' | 'changes';
	let viewMode = $state<ViewMode>('current');

	// Get document slug for version tracking
	const slug = $derived(document.tagValue('d') || '');

	// Get previous version from the centralized store
	const previousVersion = $derived.by(() => {
		if (!slug) return null;
		// The store returns NDKArticle which extends NDKEvent
		return reportsStore.getPreviousVersion(slug, document as any) || null;
	});

	// Watch for new versions from the store and update the document
	$effect(() => {
		if (!slug) return;

		// Get the latest version from the store
		const latestVersion = reportsStore.getBySlug(slug);

		if (latestVersion && latestVersion.id !== document.id) {
			// Check if the latest is actually newer
			if ((latestVersion.created_at || 0) > (document.created_at || 0)) {
				// New version detected - trigger fade transition
				if (latestVersion.id !== previousEventId) {
					pendingDocument = latestVersion;
					isTransitioning = true;

					// After fade-out, swap the document and fade-in
					setTimeout(() => {
						document = pendingDocument!;
						previousEventId = latestVersion.id;
						pendingDocument = null;
						isTransitioning = false;
					}, 200); // Match the CSS transition duration
				}
			}
		}
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

	// Copy dropdown state
	let copyDropdownOpen = $state(false);
	let copySuccessMessage = $state<string | null>(null);

	async function handleCopy(type: 'bech32' | 'raw' | 'markdown') {
		try {
			let content: string;
			let message: string;

			switch (type) {
				case 'bech32':
					content = document.encode();
					message = 'Copied Bech32 Event ID';
					break;
				case 'raw':
					content = document.inspect;
					message = 'Copied Raw Event';
					break;
				case 'markdown':
					content = document.content || '';
					message = 'Copied Markdown Content';
					break;
			}

			await navigator.clipboard.writeText(content);
			copySuccessMessage = message;
			copyDropdownOpen = false;

			// Clear success message after 2 seconds
			setTimeout(() => {
				copySuccessMessage = null;
			}, 2000);
		} catch (error) {
			console.error('Failed to copy:', error);
		}
	}

	function handleCopyDropdownKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			copyDropdownOpen = false;
		}
	}

	function closeCopyDropdown() {
		copyDropdownOpen = false;
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
			<!-- Copy dropdown -->
			<div class="relative">
				<button
					type="button"
					onclick={() => copyDropdownOpen = !copyDropdownOpen}
					class="flex items-center gap-0.5 p-1.5 rounded hover:bg-muted transition-colors"
					aria-label="Copy options"
					aria-expanded={copyDropdownOpen}
					aria-haspopup="true"
				>
					<Copy class="h-4 w-4" />
					<ChevronDown class="h-3 w-3" />
				</button>

				{#if copyDropdownOpen}
					<!-- Backdrop to close dropdown when clicking outside -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="fixed inset-0 z-40"
						onclick={closeCopyDropdown}
						onkeydown={handleCopyDropdownKeydown}
					></div>

					<!-- Dropdown menu -->
					<div
						class="absolute right-0 top-full mt-1 z-50 min-w-[200px] bg-popover border border-border rounded-md shadow-md py-1"
						role="menu"
						aria-orientation="vertical"
					>
						<button
							type="button"
							onclick={() => handleCopy('bech32')}
							class="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center gap-2"
							role="menuitem"
						>
							<Copy class="h-4 w-4" />
							Copy Bech32 Event ID
						</button>
						<button
							type="button"
							onclick={() => handleCopy('raw')}
							class="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center gap-2"
							role="menuitem"
						>
							<Copy class="h-4 w-4" />
							Copy Raw Event
						</button>
						<button
							type="button"
							onclick={() => handleCopy('markdown')}
							class="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center gap-2"
							role="menuitem"
						>
							<Copy class="h-4 w-4" />
							Copy Markdown Content
						</button>
					</div>
				{/if}

				<!-- Success message toast -->
				{#if copySuccessMessage}
					<div class="absolute right-0 top-full mt-1 z-50 px-3 py-2 bg-foreground text-background text-xs rounded-md shadow-md whitespace-nowrap">
						{copySuccessMessage}
					</div>
				{/if}
			</div>
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
