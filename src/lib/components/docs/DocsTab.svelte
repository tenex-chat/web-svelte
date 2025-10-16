<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { FileText, Search, X } from 'lucide-svelte';
	import type { NDKProject } from '$lib/events/NDKProject';
	import type { NDKArticle, NDKEvent } from '@nostr-dev-kit/ndk';
	import { windowManager } from '$lib/stores/windowManager.svelte';
	import DocumentItem from './DocumentItem.svelte';

	interface Props {
		project: NDKProject;
	}

	let { project }: Props = $props();

	let searchQuery = $state('');

	// Subscribe to kind 30023 (long-form articles/documents) for this project
	const subscription = ndk.$subscribe<NDKArticle>(
		() => {
			const filter = project.filter();
			return {
				filters: [
					{
						...filter,
						kinds: [30023] // Only documents
					}
				],
				closeOnEose: false,
				wrap: true
			};
		}
	);

	// Sort documents by timestamp (newest first)
	const sortedDocuments = $derived.by(() => {
		const events = subscription.events as NDKEvent[];
		return [...events].sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
	});

	// Function to check if a document matches the search query
	function documentMatchesSearch(event: NDKEvent, query: string): boolean {
		const lowerQuery = query.toLowerCase();

		// Check title
		const title = event.tagValue('title') || '';
		if (title.toLowerCase().includes(lowerQuery)) {
			return true;
		}

		// Check summary
		const summary = event.tagValue('summary') || '';
		if (summary.toLowerCase().includes(lowerQuery)) {
			return true;
		}

		// Check content
		if (event.content && event.content.toLowerCase().includes(lowerQuery)) {
			return true;
		}

		// Check hashtags
		const hashtags = event.tags.filter((tag) => tag[0] === 't').map((tag) => tag[1]);
		for (const hashtag of hashtags) {
			if (hashtag.toLowerCase().includes(lowerQuery)) {
				return true;
			}
		}

		return false;
	}

	// Filter documents based on search query
	const filteredDocuments = $derived.by(() => {
		if (!searchQuery.trim()) {
			return sortedDocuments;
		}
		return sortedDocuments.filter((doc) => documentMatchesSearch(doc, searchQuery));
	});

	// Handle empty states
	const showNoResults = $derived(searchQuery && filteredDocuments.length === 0);

	function handleDocumentClick(document: NDKEvent) {
		windowManager.open({
			type: 'document',
			title: document.tagValue('title') || 'Untitled Document',
			project,
			data: { document }
		});
	}
</script>

<div class="h-full flex flex-col">
	<!-- Search Input - Only show when there are documents -->
	{#if sortedDocuments.length > 0}
		<div class="border-b bg-white/50">
			<div class="relative">
				<Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
				<input
					type="text"
					placeholder="Search documents by title, summary, or content..."
					bind:value={searchQuery}
					class="w-full pl-9 pr-9 h-12 text-sm border-0 focus:outline-none focus:ring-0"
				/>
				{#if searchQuery}
					<button
						type="button"
						onclick={() => (searchQuery = '')}
						class="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 hover:bg-gray-100 rounded transition-colors flex items-center justify-center"
					>
						<X class="h-3.5 w-3.5" />
					</button>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Document list or empty states -->
	{#if sortedDocuments.length === 0}
		<div class="flex flex-col items-center justify-center h-full p-6 text-center">
			<FileText class="h-12 w-12 text-gray-300 mb-3" />
			<h3 class="font-semibold text-sm mb-1">No documents yet</h3>
			<p class="text-xs text-gray-500 max-w-[200px]">
				Documentation for this project will appear here
			</p>
		</div>
	{:else if showNoResults}
		<div class="flex flex-col items-center justify-center h-full p-6 text-center">
			<Search class="h-12 w-12 text-gray-300 mb-3" />
			<h3 class="font-semibold text-sm mb-1">No results found</h3>
			<p class="text-xs text-gray-500 max-w-[200px]">Try adjusting your search terms</p>
			<button
				type="button"
				onclick={() => (searchQuery = '')}
				class="mt-3 px-3 py-1.5 text-sm hover:bg-gray-100 rounded transition-colors"
			>
				Clear search
			</button>
		</div>
	{:else}
		<div class="flex-1 overflow-auto">
			<div>
				{#each filteredDocuments as document (document.id)}
					<DocumentItem {document} onclick={() => handleDocumentClick(document)} />
				{/each}
			</div>
		</div>
	{/if}
</div>
