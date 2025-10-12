<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { Users, Search, X, Filter } from 'lucide-svelte';
	import type { NDKProject } from '$lib/events/NDKProject';
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import EventItem from './EventItem.svelte';

	interface Props {
		project: NDKProject;
		onEventClick?: (event: NDKEvent) => void;
	}

	let { project, onEventClick }: Props = $props();

	let searchQuery = $state('');
	let selectedAuthor = $state<string | null>(null);
	let groupThreads = $state(false);

	const currentUser = $derived(ndk.$sessions.currentUser);

	// Subscribe to project events
	const subscription = ndk.$subscribe(
		() => {
			const filter = project.filter();
			if (!filter || Object.keys(filter).length === 0) return null;
			return {
				filters: [filter],
				closeOnEose: false
			};
		},
		{ bufferMs: 100 }
	);

	// Filter out ephemeral events and kind 0, then sort
	const sortedEvents = $derived.by(() => {
		const events = subscription.events as NDKEvent[];

		// Filter out unwanted events
		const validEvents = events.filter((event) => {
			const kind = event.kind || 0;
			// Skip kind 0 (metadata) and ephemeral events (kinds 20000-29999)
			if (kind === 0 || (kind >= 20000 && kind <= 29999)) {
				return false;
			}
			return true;
		});

		// Sort by timestamp (newest first)
		return validEvents.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
	});

	// Function to check if an event matches the search query
	function eventMatchesSearch(event: NDKEvent, query: string): boolean {
		const lowerQuery = query.toLowerCase();

		// Check event content
		if (event.content && event.content.toLowerCase().includes(lowerQuery)) {
			return true;
		}

		// Check article title (for kind 30023)
		if (event.kind === 30023) {
			const title = event.tagValue('title') || event.tagValue('name') || '';
			if (title.toLowerCase().includes(lowerQuery)) {
				return true;
			}
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

	// Get unique authors
	const uniqueAuthors = $derived.by(() => {
		const pubkeysSet = new Set<string>();

		sortedEvents.forEach((event) => {
			pubkeysSet.add(event.pubkey);
		});

		// Convert to array and sort by pubkey for stability
		const allAuthors = Array.from(pubkeysSet).sort();

		// Limit to 15 authors
		const limitedAuthors = allAuthors.slice(0, 15);

		// Build final list with current user first
		const result: string[] = [];

		// Add current user first if they have events
		if (currentUser?.pubkey && limitedAuthors.includes(currentUser.pubkey)) {
			result.push(currentUser.pubkey);
		}

		// Add other authors
		limitedAuthors.forEach((pubkey) => {
			if (pubkey !== currentUser?.pubkey) {
				result.push(pubkey);
			}
		});

		return result;
	});

	// Filter events based on search query and author
	const filteredEvents = $derived.by(() => {
		let filtered = sortedEvents;

		// Apply author filter
		if (selectedAuthor) {
			filtered = filtered.filter((event) => event.pubkey === selectedAuthor);
		}

		// Apply search filter
		if (searchQuery.trim()) {
			filtered = filtered.filter((event) => eventMatchesSearch(event, searchQuery));
		}

		return filtered;
	});

	// Handle empty states
	const showNoResults = $derived(searchQuery && filteredEvents.length === 0);
</script>

<div class="h-full flex flex-col">
	<!-- Search Input and Filter - Only show when there are events -->
	{#if sortedEvents.length > 0}
		<div class="border-b bg-white/50">
			<div class="flex gap-2">
				<div class="relative flex-1">
					<Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
					<input
						type="text"
						placeholder="Search events, titles, subjects, hashtags..."
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

				<!-- Author Filter Dropdown -->
				<div class="mt-1.5 mr-1.5">
					<button
						type="button"
						class="h-9 w-9 p-0 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
						class:bg-blue-600={selectedAuthor}
						class:text-white={selectedAuthor}
					>
						{#if selectedAuthor}
							<div
								class="w-6 h-6 rounded-full bg-white text-blue-600 flex items-center justify-center text-xs font-semibold"
							>
								{selectedAuthor.slice(0, 2).toUpperCase()}
							</div>
						{:else}
							<Filter class="h-3.5 w-3.5" />
						{/if}
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Event list or empty states -->
	{#if sortedEvents.length === 0}
		<div class="flex flex-col items-center justify-center h-full p-6 text-center">
			<Users class="h-12 w-12 text-gray-300 mb-3" />
			<h3 class="font-semibold text-sm mb-1">No events yet</h3>
			<p class="text-xs text-gray-500 max-w-[200px]">Events from this project will appear here</p>
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
			{#each filteredEvents as event (event.id)}
				<EventItem {event} onclick={() => onEventClick?.(event)} />
			{/each}
		</div>
	{/if}
</div>
