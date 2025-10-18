<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { Users, Search, X, Filter, Check } from 'lucide-svelte';
	import type { NDKProject } from '$lib/events/NDKProject';
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import EventItem from './EventItem.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Avatar } from '@nostr-dev-kit/svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import VirtualList from '@humanspeak/svelte-virtual-list';

	interface Props {
		project: NDKProject;
		onEventClick?: (event: NDKEvent) => void;
	}

	let { project, onEventClick }: Props = $props();

	let searchQuery = $state('');
	let selectedAuthor = $state<string | null>(null);
	let groupThreads = $state(false);
	let filterDropdownOpen = $state(false);


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

	// Filter out ephemeral events and kind 0, then optionally group by E tag, then sort
	const sortedEvents = $derived.by(() => {
		const events = subscription.events as NDKEvent[];

		// Filter out unwanted events
		let validEvents = events.filter((event) => {
			const kind = event.kind || 0;
			// Skip kind 0 (metadata) and ephemeral events (kinds 20000-29999)
			if (kind === 0 || (kind >= 20000 && kind <= 29999)) {
				return false;
			}
			return true;
		});

		// If groupThreads is enabled, deduplicate by E tag
		if (groupThreads) {
			validEvents = deduplicateEventsByETag(validEvents);
		}

		// Sort by timestamp (newest first)
		return validEvents.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
	});

	// Helper function to deduplicate events by E tag (thread grouping)
	function deduplicateEventsByETag(events: NDKEvent[]): NDKEvent[] {
		// Group events by E tag value
		const eventsByETag = new SvelteMap<string | null, NDKEvent[]>();

		events.forEach((event) => {
			// Get the E tag value (uppercase E tag)
			const eTag = event.tags.find((tag) => tag[0] === 'E')?.[1] || null;

			// Group events by their E tag value (or null if no E tag)
			const existing = eventsByETag.get(eTag) || [];
			existing.push(event);
			eventsByETag.set(eTag, existing);
		});

		// For each E tag group, keep only the most recent event
		const deduplicatedEvents: NDKEvent[] = [];

		eventsByETag.forEach((groupedEvents, eTag) => {
			if (eTag === null) {
				// No E tag - include all events from this group
				deduplicatedEvents.push(...groupedEvents);
			} else {
				// Has E tag - only include the most recent one
				const mostRecent = groupedEvents.reduce((latest, current) => {
					const latestTime = latest.created_at || 0;
					const currentTime = current.created_at || 0;
					return currentTime > latestTime ? current : latest;
				});
				deduplicatedEvents.push(mostRecent);
			}
		});

		return deduplicatedEvents;
	}

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
		const pubkeysSet = new SvelteSet<string>();

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
		if (ndk.$currentUser?.pubkey && limitedAuthors.includes(ndk.$currentUser.pubkey)) {
			result.push(ndk.$currentUser.pubkey);
		}

		// Add other authors
		limitedAuthors.forEach((pubkey) => {
			if (pubkey !== ndk.$currentUser?.pubkey) {
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
		<div class="border-b bg-card/50">
			<div class="flex gap-2">
				<div class="relative flex-1">
					<Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
							class="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 hover:bg-muted rounded transition-colors flex items-center justify-center"
						>
							<X class="h-3.5 w-3.5" />
						</button>
					{/if}
				</div>

				<!-- Author Filter Dropdown -->
				<div class="mt-1.5 mr-1.5">
					<DropdownMenu.Root bind:open={filterDropdownOpen}>
						<DropdownMenu.Trigger asChild>
							<button
								type="button"
								class="h-9 w-9 p-0 flex items-center justify-center border border-border rounded-lg hover:bg-muted transition-colors"
								class:bg-primary={selectedAuthor}
								class:text-white={selectedAuthor}
							>
								{#if selectedAuthor}
									<Avatar {ndk} pubkey={selectedAuthor} size={24} class="rounded-full" />
								{:else}
									<Filter class="h-3.5 w-3.5" />
								{/if}
							</button>
						</DropdownMenu.Trigger>
						<DropdownMenu.Content align="end" class="w-[200px]">
							<!-- Group threads checkbox -->
							<DropdownMenu.CheckboxItem bind:checked={groupThreads}>
								Group threads
							</DropdownMenu.CheckboxItem>
							<DropdownMenu.Separator />

							<!-- All Authors option -->
							<DropdownMenu.Item onclick={() => (selectedAuthor = null)}>
								<div class="flex items-center justify-between w-full">
									<span>All Authors</span>
									{#if !selectedAuthor}
										<Check class="h-3.5 w-3.5" />
									{/if}
								</div>
							</DropdownMenu.Item>

							{#if uniqueAuthors.length > 0}
								<DropdownMenu.Separator />

								<!-- List all authors -->
								{#each uniqueAuthors as pubkey (pubkey)}
									{@const isCurrentUser = ndk.$currentUser?.pubkey === pubkey}
									{@const profile = ndk.$fetchProfile(() => pubkey)}
									<DropdownMenu.Item onclick={() => (selectedAuthor = pubkey)}>
										<div class="flex items-center justify-between w-full">
											<div class="flex items-center gap-2">
												<Avatar {ndk} {pubkey} size={20} class="rounded-full flex-shrink-0" />
												{#if isCurrentUser}
													<span class="text-sm">You</span>
												{:else}
													<span class="text-sm">
														{profile?.name || profile?.displayName || `${pubkey.slice(0, 8)}...`}
													</span>
												{/if}
											</div>
											{#if selectedAuthor === pubkey}
												<Check class="h-3.5 w-3.5" />
											{/if}
										</div>
									</DropdownMenu.Item>
								{/each}
							{/if}
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				</div>
			</div>
		</div>
	{/if}

	<!-- Event list or empty states -->
	{#if sortedEvents.length === 0}
		<div class="flex flex-col items-center justify-center h-full p-6 text-center">
			<Users class="h-12 w-12 text-muted-foreground mb-3" />
			<h3 class="font-semibold text-sm mb-1">No events yet</h3>
			<p class="text-xs text-muted-foreground max-w-[200px]">Events from this project will appear here</p>
		</div>
	{:else if showNoResults}
		<div class="flex flex-col items-center justify-center h-full p-6 text-center">
			<Search class="h-12 w-12 text-muted-foreground mb-3" />
			<h3 class="font-semibold text-sm mb-1">No results found</h3>
			<p class="text-xs text-muted-foreground max-w-[200px]">Try adjusting your search terms</p>
			<button
				type="button"
				onclick={() => (searchQuery = '')}
				class="mt-3 px-3 py-1.5 text-sm hover:bg-muted rounded transition-colors"
			>
				Clear search
			</button>
		</div>
	{:else}
		<div class="flex-1 overflow-auto">
			<VirtualList items={filteredEvents} height="100%" itemHeight={80}>
				{#snippet slot({ item: event })}
					<EventItem {event} onclick={() => onEventClick?.(event)} />
				{/snippet}
			</VirtualList>
		</div>
	{/if}
</div>
