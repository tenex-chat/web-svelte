<script lang="ts">
	import { inboxStore } from '$lib/stores/inbox.svelte';
	import { inboxColumnStore } from '$lib/stores/inboxColumn.svelte';
	import { windowManager } from '$lib/stores/windowManager.svelte';
	import { storage } from '$lib/utils/storage.svelte';
	import { cn } from '$lib/utils/cn';
	import { Inbox, X } from 'lucide-svelte';
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import InboxThreadList from './inbox/InboxThreadList.svelte';

	// Track viewed events for reactive unread count
	const viewedEventIds = $derived(new Set(Object.keys(storage.getViewedAskEvents())));

	// Compute unread count reactively
	const unreadCount = $derived(
		inboxStore.events.filter(e =>
			!viewedEventIds.has(e.id) && (e.created_at ? e.created_at > inboxStore.lastVisit : false)
		).length
	);

	interface Props {
		class?: string;
	}

	let { class: className }: Props = $props();

	// Inbox accent color (amber/orange theme)
	const inboxColor = 'hsl(38, 92%, 50%)';

	// Handle thread selection - open the chat
	async function handleThreadSelect(thread: NDKEvent) {
		await windowManager.openChatFromEvent(thread);
	}
</script>

<div class={cn('w-96 flex-shrink-0 flex flex-col bg-card border-r border-border relative', className)}>
	<!-- Glow effect at top -->
	<div
		class="absolute top-0 left-0 right-0 h-96 pointer-events-none z-0"
		style="background: linear-gradient(to bottom, hsla(38, 92%, 60%, 0.25), hsla(38, 92%, 55%, 0.05) 70%, transparent)"
	></div>

	<!-- Column Header -->
	<div class="border-b border-border relative z-10">
		<div class="px-3 py-2">
			<div class="flex items-center gap-2">
				<!-- Inbox Icon -->
				<div
					class="w-6 h-6 rounded flex items-center justify-center text-white"
					style="background: {inboxColor}"
				>
					<Inbox class="w-4 h-4" />
				</div>

				<!-- Title -->
				<h3 class="font-medium text-sm truncate flex-1 text-foreground">Inbox</h3>

				<!-- Unread Badge -->
				{#if unreadCount > 0}
					<span class="px-1.5 py-0.5 text-xs font-medium bg-primary text-primary-foreground rounded animate-pulse">
						{unreadCount > 9 ? '9+' : unreadCount}
					</span>
				{/if}

				<!-- Close Button -->
				<button
					onclick={() => inboxColumnStore.close()}
					class="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground rounded hover:bg-muted transition-colors"
					title="Close inbox"
					aria-label="Close inbox"
				>
					<X class="h-3.5 w-3.5" />
				</button>
			</div>
		</div>

		<!-- Subtitle showing event count -->
		<div class="px-3 pb-2 text-xs text-muted-foreground">
			{inboxStore.events.length} {inboxStore.events.length === 1 ? 'message' : 'messages'}
		</div>
	</div>

	<!-- Content -->
	<div class="flex-1 overflow-hidden relative">
		<InboxThreadList
			onThreadSelect={handleThreadSelect}
		/>
	</div>
</div>
