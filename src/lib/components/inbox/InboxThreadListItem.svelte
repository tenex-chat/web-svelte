<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import { AlertCircle } from 'lucide-svelte';
	import TimeAgo from '$lib/components/common/TimeAgo.svelte';
	import { User } from '$lib/ndk/ui/user';
	import { ndk } from '$lib/ndk.svelte';
	import { isAskEvent } from '$lib/utils/askTags';
	import { cn } from '$lib/utils/cn';

	interface Props {
		thread: NDKEvent;
		isSelected: boolean;
		isUnread: boolean;
		onclick: () => void;
		onlongpress?: (position: { x: number; y: number }) => void;
	}

	const { thread, isSelected, isUnread, onclick, onlongpress }: Props = $props();

	// Long-press detection
	const LONG_PRESS_DURATION = 500; // ms
	let longPressTimer: ReturnType<typeof setTimeout> | null = null;
	let isLongPressing = $state(false);
	let startPosition = { x: 0, y: 0 };

	function handlePointerDown(e: PointerEvent) {
		// Only handle primary button (left click / touch)
		if (e.button !== 0) return;

		startPosition = { x: e.clientX, y: e.clientY };
		isLongPressing = false;

		longPressTimer = setTimeout(() => {
			isLongPressing = true;
			if (onlongpress) {
				// Position the window near the click, offset to the right
				onlongpress({ x: e.clientX + 20, y: Math.max(50, e.clientY - 100) });
			}
		}, LONG_PRESS_DURATION);
	}

	function handlePointerUp(e: PointerEvent) {
		if (longPressTimer) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}

		// Only trigger onclick if it wasn't a long press
		if (!isLongPressing) {
			onclick();
		}
		isLongPressing = false;
	}

	function handlePointerMove(e: PointerEvent) {
		// Cancel long press if user moves too much (allows scrolling)
		const moveThreshold = 10;
		const dx = Math.abs(e.clientX - startPosition.x);
		const dy = Math.abs(e.clientY - startPosition.y);

		if (dx > moveThreshold || dy > moveThreshold) {
			if (longPressTimer) {
				clearTimeout(longPressTimer);
				longPressTimer = null;
			}
		}
	}

	function handlePointerCancel() {
		if (longPressTimer) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}
		isLongPressing = false;
	}

	// Check if this is an ask event
	const isAsk = $derived(isAskEvent(thread));

	// Get title from title tag or content
	const title = $derived(
		thread.tagValue('title') ||
		thread.content?.slice(0, 50) ||
		'Untitled'
	);

	const displayTime = $derived(thread.created_at || 0);

	// Get the project this event is associated with (from 'a' tag)
	const projectTag = $derived(thread.tagValue('a'));
	const projectName = $derived.by(() => {
		if (!projectTag) return null;
		// Extract project name from a-tag format: "kind:pubkey:d-tag"
		const parts = projectTag.split(':');
		return parts.length >= 3 ? parts[2] : null;
	});
</script>

<button
	onpointerdown={handlePointerDown}
	onpointerup={handlePointerUp}
	onpointermove={handlePointerMove}
	onpointercancel={handlePointerCancel}
	onpointerleave={handlePointerCancel}
	oncontextmenu={(e) => e.preventDefault()}
	class={cn(
		"w-full text-left px-3 py-3 hover:bg-muted transition-colors border-b border-border touch-none relative",
		isSelected && 'bg-primary/10',
		isUnread && 'bg-amber-50/50 dark:bg-amber-950/20'
	)}
>
	<!-- Unread indicator -->
	{#if isUnread}
		<div
			class="absolute left-0 top-0 bottom-0 w-1 bg-amber-500"
			style="box-shadow: 0 0 10px rgba(245, 158, 11, 0.6)"
		></div>
	{:else if isAsk}
		<div
			class="absolute left-0 top-0 bottom-0 w-1"
		></div>
	{/if}

	<div class={cn("flex items-center gap-2 mb-1", (isUnread || isAsk) && "ml-2")}>
		<span class="font-medium text-sm text-foreground truncate flex-1">{title}</span>
		{#if isUnread}
			<span
				class="px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-700/50"
				title="This conversation has a question waiting for response"
			>
				New
			</span>
		{/if}
	</div>

	<!-- Content preview -->
	{#if thread.content}
		<div class={cn("text-xs text-muted-foreground truncate mb-2", (isUnread || isAsk) && "ml-2")}>
			{thread.content.slice(0, 80)}{thread.content.length > 80 ? '...' : ''}
		</div>
	{/if}

	<div class={cn("flex items-center gap-3 text-xs text-muted-foreground", (isUnread || isAsk) && "ml-2")}>
		<User.Root {ndk} pubkey={thread.pubkey}>
			<div class="flex items-center gap-1.5">
				<User.Avatar class="w-4 h-4 rounded-full" />
				<User.Name class="truncate max-w-[100px]" />
			</div>
		</User.Root>
		{#if projectName}
			<span class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
				{projectName}
			</span>
		{/if}
		<TimeAgo timestamp={displayTime} class="ml-auto" />
	</div>
</button>
