<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { inboxStore } from '$lib/stores/inbox.svelte';
	import { goto } from '$app/navigation';
	import InboxEventCard from '$lib/components/inbox/InboxEventCard.svelte';
	import { Inbox, Filter } from 'lucide-svelte';
	import { onMount } from 'svelte';

	// Mark inbox as read when the page is opened
	onMount(() => {
		inboxStore.markAllRead();
	});

	const currentUser = $derived(ndk.$sessions?.currentUser);

	function handleEventClick(eventId: string) {
		goto(`/chat/${eventId}`);
	}
</script>

<svelte:head>
	<title>Inbox - TENEX</title>
</svelte:head>

<div class="flex flex-col h-full">
	{#if !currentUser}
		<div class="flex flex-col items-center justify-center h-full">
			<Inbox class="h-12 w-12 text-muted-foreground/50 mb-4" />
			<h2 class="text-lg font-medium mb-2">Sign in to view your inbox</h2>
			<p class="text-sm text-muted-foreground">You need to be logged in to see your notifications</p>
		</div>
	{:else}
		<!-- Header -->
		<div class="border-b px-6 py-4">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-3">
					<Inbox class="h-5 w-5 text-muted-foreground" />
					<h1 class="text-xl font-semibold">Inbox</h1>
					{#if inboxStore.events.length > 0}
						<span class="text-sm text-muted-foreground">
							{inboxStore.events.length} events
						</span>
					{/if}
					{#if inboxStore.events.some((e) => e.created_at && e.created_at > inboxStore.lastVisit)}
						<span class="text-xs text-muted-foreground cursor-help" title="New items have a blue bar and 'New' badge">
							(New items have a blue bar and "New" badge)
						</span>
					{/if}
				</div>

				<!-- Filter dropdown (for future use) -->
				<button
					class="flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted"
				>
					<Filter class="h-4 w-4" />
					All Events
				</button>
			</div>
		</div>

		<!-- Messages List -->
		<div class="flex-1 overflow-y-auto">
			{#if inboxStore.events.length === 0}
				<div class="flex flex-col items-center justify-center h-full text-center px-6">
					<Inbox class="h-12 w-12 text-muted-foreground/50 mb-4" />
					<h2 class="text-lg font-medium mb-2">Your inbox is empty</h2>
					<p class="text-sm text-muted-foreground max-w-sm">
						When agents complete tasks or someone mentions you, those events will appear here.
					</p>
				</div>
			{:else}
				<div class="divide-y divide-border">
					{#each inboxStore.events as event (event.id)}
						<div
							class="cursor-pointer hover:bg-muted/50 transition-colors"
							onclick={() => handleEventClick(event.id)}
							role="button"
							tabindex="0"
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									handleEventClick(event.id);
								}
							}}
						>
							<InboxEventCard {event} isUnread={inboxStore.isEventUnread(event)} />
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
