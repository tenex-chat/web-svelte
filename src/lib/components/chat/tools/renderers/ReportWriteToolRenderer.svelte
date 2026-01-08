<script lang="ts">
	import { FileText, ExternalLink } from 'lucide-svelte';
	import { ndk } from '$lib/ndk.svelte';
	import { windowManager } from '$lib/stores/windowManager.svelte';
	import { NDKProject } from '$lib/events/NDKProject';
	import { NDKKind } from '$lib/kinds';
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';
	import { reportsStore } from '$lib/stores/reports.svelte';

	interface Props {
		title: string;
		documentATag: string | null;
		projectATag: string | null;
	}

	let { title, documentATag, projectATag }: Props = $props();

	// Project state (still needs fetching as it's not in reportsStore)
	let project = $state<NDKProject | undefined>(undefined);

	/**
	 * Parse an "a" tag value into its components
	 * Format: "kind:pubkey:d-tag"
	 */
	function parseATag(aTagValue: string): { kind: number; pubkey: string; dTag: string } | null {
		const parts = aTagValue.split(':');
		if (parts.length < 3) return null;
		return {
			kind: parseInt(parts[0], 10),
			pubkey: parts[1],
			dTag: parts.slice(2).join(':') // Handle d-tags that might contain colons
		};
	}

	// Parse the document a-tag to get the d-tag (slug)
	const documentSlug = $derived.by(() => {
		if (!documentATag) return null;
		const parsed = parseATag(documentATag);
		return parsed?.dTag || null;
	});

	// Get document from centralized store
	const docEvent = $derived.by(() => {
		if (!documentSlug) return null;
		return reportsStore.getBySlug(documentSlug) || null;
	});

	// Check if document is still loading (store is loading and document not found yet)
	const isLoading = $derived(reportsStore.loading && !docEvent);

	// Check if there was an error (store finished loading but document not found)
	const fetchError = $derived(!reportsStore.loading && documentSlug && !docEvent);

	// Fetch project separately (not in reportsStore)
	$effect(() => {
		if (!projectATag) return;

		const projectParsed = parseATag(projectATag);
		if (projectParsed) {
			ndk.fetchEvent({
				kinds: [NDKKind.Project],
				authors: [projectParsed.pubkey],
				'#d': [projectParsed.dTag]
			}).then((projectEvent) => {
				if (projectEvent) {
					project = NDKProject.from(projectEvent);
				}
			}).catch((error) => {
				console.error('Failed to fetch project:', error);
			});
		}
	});

	function handleClick() {
		if (!docEvent) return;

		// Open immediately - data is already fetched
		windowManager.open({
			type: 'document',
			title: docEvent.tagValue('title') || title || 'Untitled Document',
			project,
			data: { document: docEvent }
		});
	}

	// Render preview content (truncated markdown)
	const previewContent = $derived.by(() => {
		if (!docEvent?.content) return '';
		try {
			const rawHtml = marked.parse(docEvent.content) as string;
			return DOMPurify.sanitize(rawHtml);
		} catch {
			return docEvent.content;
		}
	});
</script>

<div class="flex flex-col gap-2">
	<!-- Header row -->
	<div class="flex items-center gap-2 text-sm text-muted-foreground">
		<FileText class="w-4 h-4 flex-shrink-0" />
		{#if documentATag && docEvent}
			<button
				type="button"
				class="flex items-center gap-1.5 hover:text-foreground transition-colors group"
				onclick={handleClick}
			>
				<span>
					Created report: <span class="text-foreground font-medium group-hover:underline">{title}</span>
				</span>
				<ExternalLink class="w-3.5 h-3.5 opacity-50 group-hover:opacity-100" />
			</button>
		{:else if documentATag && isLoading}
			<span>Created report: {title} <span class="text-xs">(loading...)</span></span>
		{:else}
			<span>Created report: {title}</span>
		{/if}
	</div>

	<!-- Preview window -->
	{#if documentATag && docEvent && previewContent}
		<button
			type="button"
			onclick={handleClick}
			class="group relative w-full max-w-md rounded-lg border border-border bg-card hover:border-primary/50 hover:bg-muted/50 transition-all cursor-pointer overflow-hidden text-left"
		>
			<!-- Preview content with fade overlay -->
			<div class="h-32 overflow-hidden p-3">
				<div
					class="prose prose-sm prose-neutral dark:prose-invert max-w-none
						prose-headings:text-sm prose-headings:font-semibold prose-headings:mb-1
						prose-p:text-xs prose-p:mb-2 prose-p:leading-relaxed
						prose-ul:text-xs prose-ul:pl-4 prose-ul:mb-2
						prose-ol:text-xs prose-ol:pl-4 prose-ol:mb-2
						prose-li:mb-0.5
						prose-code:text-xs prose-code:bg-muted prose-code:px-1 prose-code:rounded
						prose-pre:text-xs prose-pre:p-2 prose-pre:bg-muted prose-pre:rounded
						text-foreground/80"
				>
					{@html previewContent}
				</div>
			</div>
			<!-- Fade overlay at bottom -->
			<div class="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card to-transparent pointer-events-none"></div>
			<!-- Click hint -->
			<div class="absolute bottom-2 right-2 flex items-center gap-1 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
				<span>Click to open</span>
				<ExternalLink class="w-3 h-3" />
			</div>
		</button>
	{/if}
</div>
