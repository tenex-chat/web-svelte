<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import { inboxStore } from '$lib/stores/inbox.svelte';
	import { windowManager } from '$lib/stores/windowManager.svelte';
	import { goto } from '$app/navigation';
	import InboxEventCard from './InboxEventCard.svelte';
	import { Inbox } from 'lucide-svelte';

	interface Props {
		open?: boolean;
		children?: any;
	}

	let { open = $bindable(false), children }: Props = $props();

	let triggerRef: HTMLElement | null = $state(null);
	let popoverRef: HTMLDivElement | null = $state(null);
	let markAsReadTimer: NodeJS.Timeout | null = null;
	let popoverPosition = $state<{ top: number; left: number } | null>(null);

	// Get recent events to show (max 5)
	const recentEvents = $derived(inboxStore.events.slice(0, 5));

	// Calculate popover position when it opens
	function calculatePosition() {
		if (!triggerRef) return;

		const rect = triggerRef.getBoundingClientRect();
		const popoverWidth = 400;
		const popoverMaxHeight = 400;
		const offset = 12;

		let top = rect.top;
		let left = rect.right + offset;

		// Check if popover would overflow right edge of viewport
		if (left + popoverWidth > window.innerWidth) {
			// Try positioning to the left of the trigger instead
			left = rect.left - popoverWidth - offset;

			// If that also overflows, just position at the right edge with margin
			if (left < 0) {
				left = window.innerWidth - popoverWidth - 16; // 16px margin
			}
		}

		// Check if popover would overflow bottom edge of viewport
		if (top + popoverMaxHeight > window.innerHeight) {
			// Align to bottom edge with margin
			top = Math.max(16, window.innerHeight - popoverMaxHeight - 16);
		}

		// Ensure it doesn't overflow the top
		if (top < 16) {
			top = 16;
		}

		popoverPosition = { top, left };
	}

	function handleTriggerClick() {
		open = !open;
		if (open) {
			calculatePosition();
		}
	}

	function handleClickOutside(event: MouseEvent) {
		if (
			open &&
			triggerRef &&
			popoverRef &&
			!triggerRef.contains(event.target as Node) &&
			!popoverRef.contains(event.target as Node)
		) {
			open = false;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && open) {
			open = false;
		}
	}

	function handleOpenInboxPage() {
		open = false;
		goto('/inbox');
	}

	async function handleEventClick(event: NDKEvent) {
		open = false;
		await windowManager.openChatFromEvent(event);
	}

	// Mark as read when opening the popover
	$effect(() => {
		if (open && inboxStore.unreadCount > 0) {
			// Mark as read after a small delay to ensure user actually sees the content
			markAsReadTimer = setTimeout(() => {
				inboxStore.markAllRead();
			}, 1500);
		} else if (!open && markAsReadTimer) {
			clearTimeout(markAsReadTimer);
			markAsReadTimer = null;
		}

		return () => {
			if (markAsReadTimer) {
				clearTimeout(markAsReadTimer);
			}
		};
	});

	$effect(() => {
		if (open) {
			document.addEventListener('mousedown', handleClickOutside);
			document.addEventListener('keydown', handleKeydown);
			window.addEventListener('resize', calculatePosition);
			window.addEventListener('scroll', calculatePosition, true);
		}
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
			document.removeEventListener('keydown', handleKeydown);
			window.removeEventListener('resize', calculatePosition);
			window.removeEventListener('scroll', calculatePosition, true);
		};
	});
</script>

<div class="relative">
	<div
		bind:this={triggerRef}
		onclick={handleTriggerClick}
		role="button"
		tabindex="0"
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				handleTriggerClick();
			}
		}}
	>
		{@render children?.()}
	</div>

	{#if open && popoverPosition}
		<div
			bind:this={popoverRef}
			class="fixed w-[400px] bg-card rounded-lg shadow-xl border border-border overflow-hidden z-50"
			style="top: {popoverPosition.top}px; left: {popoverPosition.left}px;"
		>
			<!-- Header -->
			<div class="flex items-center justify-between px-4 py-3 border-b border-border">
				<div class="flex items-center gap-2">
					<Inbox class="h-5 w-5" />
					<h3 class="font-semibold text-foreground">Inbox</h3>
					{#if inboxStore.events.length > 0}
						<span class="text-sm text-muted-foreground">
							({inboxStore.events.length} events)
						</span>
					{/if}
				</div>
				<button
					onclick={handleOpenInboxPage}
					class="text-sm text-primary hover:text-primary/80 font-medium"
				>
					View All
				</button>
			</div>

			<!-- Content -->
			<div class="max-h-[400px] overflow-y-auto">
				{#if inboxStore.events.length === 0}
					<div class="p-8 text-center">
						<Inbox class="h-10 w-10 mx-auto mb-2 opacity-50 text-muted-foreground" />
						<p class="text-sm text-muted-foreground">Your inbox is empty</p>
					</div>
				{:else}
					<div class="divide-y divide-border">
						{#each recentEvents as event (event.id)}
							<div
								class="cursor-pointer hover:bg-muted/50 transition-colors"
								onclick={() => handleEventClick(event)}
								role="button"
								tabindex="0"
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										handleEventClick(event);
									}
								}}
							>
								<InboxEventCard {event} isUnread={inboxStore.isEventUnread(event)} />
							</div>
						{/each}
					</div>
					{#if inboxStore.events.length > 5}
						<div class="p-3 text-center border-t border-border">
							<button
								onclick={handleOpenInboxPage}
								class="w-full text-sm text-primary hover:text-primary/80 font-medium"
							>
								View all {inboxStore.events.length} events →
							</button>
						</div>
					{/if}
				{/if}
			</div>
		</div>
	{/if}
</div>
