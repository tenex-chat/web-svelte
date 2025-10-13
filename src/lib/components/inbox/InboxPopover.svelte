<script lang="ts">
	import { inboxStore } from '$lib/stores/inbox.svelte';
	import { formatRelativeTime } from '$lib/utils/time';

	interface Props {
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		children?: any;
	}

	let { open = $bindable(false), onOpenChange, children }: Props = $props();

	let triggerRef: HTMLElement | null = $state(null);
	let popoverRef: HTMLDivElement | null = $state(null);

	function handleTriggerClick() {
		open = !open;
		onOpenChange?.(open);
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
			onOpenChange?.(false);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && open) {
			open = false;
			onOpenChange?.(false);
		}
	}

	function handleMarkAllRead() {
		inboxStore.markAllRead();
	}

	$effect(() => {
		if (open) {
			document.addEventListener('mousedown', handleClickOutside);
			document.addEventListener('keydown', handleKeydown);
		}
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
			document.removeEventListener('keydown', handleKeydown);
		};
	});
</script>

<div class="relative">
	<div bind:this={triggerRef} onclick={handleTriggerClick}>
		{@render children?.()}
	</div>

	{#if open}
		<div
			bind:this={popoverRef}
			class="absolute left-0 bottom-full mb-2 w-96 bg-white dark:bg-zinc-900 rounded-lg shadow-xl border border-gray-200 dark:border-zinc-700 overflow-hidden z-50"
		>
			<!-- Header -->
			<div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-zinc-700">
				<h3 class="font-semibold text-gray-900 dark:text-gray-100">Inbox</h3>
				{#if inboxStore.unreadCount > 0}
					<button
						onclick={handleMarkAllRead}
						class="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
					>
						Mark all read
					</button>
				{/if}
			</div>

			<!-- Content -->
			<div class="max-h-[400px] overflow-y-auto">
				{#if inboxStore.items.length === 0}
					<div class="p-8 text-center">
						<svg
							class="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
							/>
						</svg>
						<p class="text-sm text-gray-500 dark:text-gray-400">No messages yet</p>
					</div>
				{:else}
					{#each inboxStore.items as item (item.id)}
						<button
							class="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors border-b border-gray-100 dark:border-zinc-700"
						>
							<div class="flex items-start gap-3">
								<div class="flex-1 min-w-0">
									<p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
										From: {item.author?.npub?.slice(0, 12)}...
									</p>
									<p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mt-1">
										{item.content}
									</p>
									<p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
										{item.created_at ? formatRelativeTime(item.created_at) : ''}
									</p>
								</div>
							</div>
						</button>
					{/each}
				{/if}
			</div>

			<!-- Footer -->
			<div class="border-t border-gray-200 dark:border-zinc-700 px-4 py-3 bg-gray-50 dark:bg-zinc-800">
				<a
					href="/inbox"
					class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium block text-center"
					onclick={() => {
						open = false;
						onOpenChange?.(false);
					}}
				>
					View all messages
				</a>
			</div>
		</div>
	{/if}
</div>
