<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import type { NDKEvent, NDKFilter, NDKUser } from '@nostr-dev-kit/ndk';
	import { Search, X, ChevronRight } from 'lucide-svelte';
	import { formatRelativeTime } from '$lib/utils/time';

	interface Props {
		rootEvent: NDKEvent;
	}

	let { rootEvent }: Props = $props();

	// State
	let searchQuery = $state('');
	let selectedKinds = $state<number[]>([]);
	let selectedAuthors = $state<string[]>([]);
	let selectedEvent = $state<NDKEvent | null>(null);
	let showEventDetail = $state(false);

	// Cache for user profiles
	let userProfiles = $state<Map<string, NDKUser>>(new Map());

	// Subscribe to events - NO FILTERS except #E and #e tags
	const subscription = ndk.$subscribe(() => {
		if (!rootEvent) return undefined;

		const filters: NDKFilter[] = [
			{
				'#e': [rootEvent.id]
			},
			{
				'#E': [rootEvent.id]
			}
		];

		return {
			filters,
			closeOnEose: false
		};
	});

	// Derived events list
	const allEvents = $derived(Array.from(subscription.events || []));

	// Filter events by search query, kinds, and authors (client-side filtering)
	const filteredEvents = $derived.by(() => {
		let events = allEvents;

		// Filter by selected kinds
		if (selectedKinds.length > 0) {
			events = events.filter((e) => selectedKinds.includes(e.kind!));
		}

		// Filter by selected authors
		if (selectedAuthors.length > 0) {
			events = events.filter((e) => selectedAuthors.includes(e.pubkey));
		}

		// Filter by search query
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			events = events.filter(
				(e) =>
					e.content.toLowerCase().includes(query) ||
					e.pubkey.toLowerCase().includes(query) ||
					e.id.toLowerCase().includes(query)
			);
		}

		// Sort by created_at (newest first)
		return events.sort((a, b) => b.created_at! - a.created_at!);
	});

	// Get unique kinds and their counts
	const kindCounts = $derived.by(() => {
		const counts = new Map<number, number>();
		allEvents.forEach((e) => {
			counts.set(e.kind!, (counts.get(e.kind!) || 0) + 1);
		});
		return counts;
	});

	// Get unique authors and their counts
	const authorCounts = $derived.by(() => {
		const counts = new Map<string, number>();
		allEvents.forEach((e) => {
			counts.set(e.pubkey, (counts.get(e.pubkey) || 0) + 1);
		});
		return counts;
	});

	// Get all unique kinds
	const allKinds = $derived(Array.from(kindCounts.keys()).sort((a, b) => a - b));

	// Get all unique authors
	const allAuthors = $derived(Array.from(authorCounts.keys()));

	// Fetch user profiles for all authors
	$effect(() => {
		allAuthors.forEach(async (pubkey) => {
			if (!userProfiles.has(pubkey)) {
				const user = ndk.getUser({ pubkey });
				await user.fetchProfile();
				userProfiles.set(pubkey, user);
				userProfiles = new Map(userProfiles);
			}
		});
	});

	// Toggle kind filter
	function toggleKind(kind: number) {
		if (selectedKinds.includes(kind)) {
			selectedKinds = selectedKinds.filter((k) => k !== kind);
		} else {
			selectedKinds = [...selectedKinds, kind];
		}
	}

	// Toggle author filter
	function toggleAuthor(author: string) {
		if (selectedAuthors.includes(author)) {
			selectedAuthors = selectedAuthors.filter((a) => a !== author);
		} else {
			selectedAuthors = [...selectedAuthors, author];
		}
	}

	// Clear all filters
	function clearFilters() {
		selectedKinds = [];
		selectedAuthors = [];
		searchQuery = '';
	}

	// Truncate content
	function truncateContent(content: string, maxLength = 100): string {
		if (content.length <= maxLength) return content;
		return content.slice(0, maxLength) + '...';
	}

	// Get kind name (fallback to just the number)
	function getKindName(kind: number): string {
		const kindNames: Record<number, string> = {
			1: 'Short Note',
			1111: 'Generic Reply',
			4199: 'Agent Definition',
			513: 'Conversation Metadata',
			24010: 'Project Status',
			24111: 'Agent Typing Start',
			24112: 'Agent Typing Stop',
			24133: 'Operations Status'
		};
		return kindNames[kind] || `Kind ${kind}`;
	}

	// Handle event click
	function handleEventClick(event: NDKEvent) {
		selectedEvent = event;
		showEventDetail = true;
	}

	// Close detail view
	function closeDetail() {
		showEventDetail = false;
		selectedEvent = null;
	}

	// Get P tags
	function getPTags(event: NDKEvent): string[] {
		return event.tags.filter((t) => t[0] === 'p' || t[0] === 'P').map((t) => t[1]);
	}

	// Get user display name
	function getUserDisplayName(pubkey: string): string {
		const user = userProfiles.get(pubkey);
		if (user?.profile) {
			return user.profile.displayName || user.profile.name || pubkey.slice(0, 8) + '...';
		}
		return pubkey.slice(0, 8) + '...';
	}
</script>

<div class="flex h-full bg-background">
	<!-- Sidebar with filters -->
	<div class="w-64 border-r border-border flex flex-col bg-muted/30">
		<!-- Search bar -->
		<div class="p-3 border-b border-border">
			<div class="relative">
				<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search..."
					class="w-full pl-9 pr-9 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
				/>
				{#if searchQuery}
					<button
						onclick={() => (searchQuery = '')}
						class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
					>
						<X class="w-4 h-4" />
					</button>
				{/if}
			</div>
		</div>

		<!-- Filters -->
		<div class="flex-1 overflow-y-auto">
			<!-- Kind filters -->
			<div class="p-3 border-b border-border">
				<div class="flex items-center justify-between mb-2">
					<h3 class="text-xs font-semibold text-muted-foreground uppercase">Kinds</h3>
					{#if selectedKinds.length > 0}
						<button
							onclick={() => (selectedKinds = [])}
							class="text-xs text-primary hover:underline"
						>
							Clear
						</button>
					{/if}
				</div>
				<div class="space-y-1">
					{#each allKinds as kind}
						<label class="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer">
							<input
								type="checkbox"
								checked={selectedKinds.includes(kind)}
								onchange={() => toggleKind(kind)}
								class="w-4 h-4 rounded border-border"
							/>
							<span class="text-sm flex-1 font-mono">{kind}</span>
							<span class="text-xs text-muted-foreground">
								{kindCounts.get(kind)}
							</span>
						</label>
					{/each}
				</div>
			</div>

			<!-- Author filters -->
			<div class="p-3">
				<div class="flex items-center justify-between mb-2">
					<h3 class="text-xs font-semibold text-muted-foreground uppercase">Authors</h3>
					{#if selectedAuthors.length > 0}
						<button
							onclick={() => (selectedAuthors = [])}
							class="text-xs text-primary hover:underline"
						>
							Clear
						</button>
					{/if}
				</div>
				<div class="space-y-1">
					{#each allAuthors as author}
						<label class="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer">
							<input
								type="checkbox"
								checked={selectedAuthors.includes(author)}
								onchange={() => toggleAuthor(author)}
								class="w-4 h-4 rounded border-border"
							/>
							<span class="text-sm flex-1 truncate" title={getUserDisplayName(author)}>
								{getUserDisplayName(author)}
							</span>
							<span class="text-xs text-muted-foreground">
								{authorCounts.get(author)}
							</span>
						</label>
					{/each}
				</div>
			</div>
		</div>

		<!-- Clear all button -->
		{#if selectedKinds.length > 0 || selectedAuthors.length > 0 || searchQuery}
			<div class="p-3 border-t border-border">
				<button
					onclick={clearFilters}
					class="w-full px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors"
				>
					Clear All Filters
				</button>
			</div>
		{/if}
	</div>

	<!-- Main content -->
	<div class="flex-1 flex flex-col overflow-hidden">
		<!-- Header -->
		<div class="p-4 border-b border-border">
			<div class="text-sm text-muted-foreground">
				Showing {filteredEvents.length} of {allEvents.length} events
			</div>
		</div>

		<!-- Events list -->
		<div class="flex-1 overflow-y-auto">
			{#if filteredEvents.length === 0}
				<div class="flex items-center justify-center h-full text-muted-foreground">
					<div class="text-center">
						<p class="text-sm">No events found</p>
						{#if selectedKinds.length > 0 || selectedAuthors.length > 0 || searchQuery}
							<button
								onclick={clearFilters}
								class="text-xs text-primary hover:underline mt-2"
							>
								Clear filters
							</button>
						{/if}
					</div>
				</div>
			{:else}
				<div class="divide-y divide-border">
					{#each filteredEvents as event (event.id)}
						<button
							onclick={() => handleEventClick(event)}
							class="w-full p-4 hover:bg-muted/50 transition-colors text-left"
						>
							<div class="flex items-start justify-between gap-3">
								<div class="flex-1 min-w-0 space-y-2">
									<!-- Kind and timestamp -->
									<div class="flex items-center gap-2 flex-wrap">
										<span
											class="inline-flex items-center px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-mono font-medium"
										>
											{event.kind}
										</span>
										<span class="text-xs text-muted-foreground">
											{formatRelativeTime(event.created_at! * 1000)}
										</span>
									</div>

									<!-- Content preview -->
									{#if event.content}
										<p class="text-sm text-foreground line-clamp-2">
											{truncateContent(event.content)}
										</p>
									{/if}

									<!-- Metadata -->
									<div class="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
										<span>
											Author: {getUserDisplayName(event.pubkey)}
										</span>
										{#if getPTags(event).length > 0}
											<span>P-tags: {getPTags(event).length}</span>
										{/if}
									</div>
								</div>

								<ChevronRight class="w-4 h-4 text-muted-foreground flex-shrink-0" />
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- Event detail aside -->
	{#if showEventDetail && selectedEvent}
		<div class="w-96 border-l border-border flex flex-col bg-card">
			<!-- Detail header -->
			<div class="p-4 border-b border-border flex items-center justify-between">
				<h3 class="text-sm font-semibold">Event Details</h3>
				<button
					onclick={closeDetail}
					class="p-1 hover:bg-muted rounded transition-colors"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<!-- Detail content -->
			<div class="flex-1 overflow-y-auto p-4 space-y-4">
				<!-- Event ID -->
				<div>
					<div class="text-xs font-semibold text-muted-foreground mb-1">Event ID</div>
					<div class="text-xs font-mono bg-muted p-2 rounded break-all">
						{selectedEvent.id}
					</div>
				</div>

				<!-- Kind -->
				<div>
					<div class="text-xs font-semibold text-muted-foreground mb-1">Kind</div>
					<div class="text-sm font-mono">
						{selectedEvent.kind}
					</div>
					<div class="text-xs text-muted-foreground mt-1">
						{getKindName(selectedEvent.kind!)}
					</div>
				</div>

				<!-- Author -->
				<div>
					<div class="text-xs font-semibold text-muted-foreground mb-1">Author</div>
					<div class="text-sm mb-1">
						{getUserDisplayName(selectedEvent.pubkey)}
					</div>
					<div class="text-xs font-mono bg-muted p-2 rounded break-all">
						{selectedEvent.pubkey}
					</div>
				</div>

				<!-- Created At -->
				<div>
					<div class="text-xs font-semibold text-muted-foreground mb-1">Created At</div>
					<div class="text-sm">
						{new Date(selectedEvent.created_at! * 1000).toLocaleString()}
					</div>
					<div class="text-xs text-muted-foreground">
						{formatRelativeTime(selectedEvent.created_at! * 1000)}
					</div>
				</div>

				<!-- Content -->
				{#if selectedEvent.content}
					<div>
						<div class="text-xs font-semibold text-muted-foreground mb-1">Content</div>
						<div class="text-sm bg-muted p-3 rounded whitespace-pre-wrap break-words">
							{selectedEvent.content}
						</div>
					</div>
				{/if}

				<!-- Tags -->
				{#if selectedEvent.tags.length > 0}
					<div>
						<div class="text-xs font-semibold text-muted-foreground mb-1">Tags</div>
						<div class="space-y-1">
							{#each selectedEvent.tags as tag}
								<div class="text-xs font-mono bg-muted p-2 rounded flex gap-2">
									<span class="text-primary font-semibold">{tag[0]}</span>
									{#each tag.slice(1) as value}
										<span class="break-all">{value}</span>
									{/each}
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- P-tags -->
				{#if getPTags(selectedEvent).length > 0}
					<div>
						<div class="text-xs font-semibold text-muted-foreground mb-1">P-Tags (Mentions)</div>
						<div class="space-y-1">
							{#each getPTags(selectedEvent) as pubkey}
								<div>
									<div class="text-sm mb-1">
										{getUserDisplayName(pubkey)}
									</div>
									<div class="text-xs font-mono bg-muted p-2 rounded break-all">
										{pubkey}
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Raw JSON -->
				<div>
					<div class="text-xs font-semibold text-muted-foreground mb-1">Raw Event JSON</div>
					<pre
						class="text-xs font-mono bg-muted p-3 rounded overflow-x-auto">{JSON.stringify(selectedEvent.rawEvent(), null, 2)}</pre>
				</div>
			</div>
		</div>
	{/if}
</div>
