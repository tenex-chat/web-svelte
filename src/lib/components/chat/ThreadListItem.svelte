<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import { X, GitBranch, ChevronRight, ChevronDown } from 'lucide-svelte';
	import ConversationMetadataDisplay from './ConversationMetadataDisplay.svelte';
	import { conversationMetadataStore } from '$lib/stores/conversationMetadata.svelte';
	import TimeAgo from '$lib/components/common/TimeAgo.svelte';
	import { generateColorFromString } from '$lib/utils/colors';
	import { User } from '$lib/ndk/ui/user';
	import { ndk } from '$lib/ndk.svelte';
	
	interface ThreadMetadata {
		latestReply: NDKEvent | null;
		participants: Set<string>;
	}

	interface Props {
		thread: NDKEvent;
		isSelected: boolean;
		conversationMetadataStore: typeof conversationMetadataStore;
		threadMetadata: Map<string, ThreadMetadata>;
		onclick: () => void;
		onlongpress?: (position: { x: number; y: number }) => void;
		onarchive?: () => void;
		/** Nesting depth (0 = root, 1+ = nested) */
		depth?: number;
		/** Whether this is the last child at its level */
		isLastChild?: boolean;
		/** Whether this item has children */
		hasChildren?: boolean;
		/** Number of descendants (children + grandchildren, etc.) */
		childCount?: number;
		/** Whether children are collapsed */
		isCollapsed?: boolean;
		/** Callback to toggle collapse state */
		onToggleCollapse?: () => void;
	}

	const { thread, isSelected, conversationMetadataStore: conversationMetadataStoreProp, threadMetadata, onclick, onlongpress, onarchive, depth = 0, isLastChild = false, hasChildren = false, childCount = 0, isCollapsed = false, onToggleCollapse }: Props = $props();

	// Use compact mode for nested threads (depth > 0)
	const isCompact = $derived(depth > 0);

	// Indentation per nesting level (in pixels)
	const INDENT_PX = 16;
	const indentStyle = $derived(depth > 0 ? `padding-left: ${depth * INDENT_PX + 12}px;` : '');

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

	const metadata = $derived(conversationMetadataStoreProp.getConversationData(thread.id));
	const title = $derived(metadata.title || thread.tagValue('title') || thread.content?.slice(0, 50) || 'Untitled');
	const statusLabel = $derived(metadata.statusLabel);
	const statusCurrentActivity = $derived(metadata.statusCurrentActivity);
	const meta = $derived(threadMetadata.get(thread.id));
	const latestReply = $derived(meta?.latestReply);
	const displayTime = $derived(latestReply?.created_at || thread.created_at || 0);
	const hashtags = $derived(thread.tags.filter((tag) => tag[0] === 't').map((tag) => tag[1]));

	// Get the recipient (first p-tag from the original post)
	const recipientPubkey = $derived(thread.tags.find((tag) => tag[0] === 'p')?.[1]);

	// Get the first hashtag for theming
	const firstHashtag = $derived(hashtags[0]);

	// Generate the background style with low opacity and inner border
	const backgroundStyle = $derived.by(() => {
		if (!firstHashtag) return '';
		const hslColor = generateColorFromString(firstHashtag);
		// Background color with 10% opacity (lower)
		const bgColor = hslColor.replace('hsl', 'hsla').replace(')', ', 0.10)');
		// Border color with 40% opacity (higher for visibility)
		const borderColor = hslColor.replace('hsl', 'hsla').replace(')', ', 0.4)');
		return `background-color: ${bgColor}; box-shadow: inset 0 0 0 1px ${borderColor};`;
	});

	// Generate dynamic color from status label
	const statusColor = $derived(statusLabel ? generateColorFromString(statusLabel) : null);

	// Check if activity is recent (within 10 minutes)
	const TEN_MINUTES = 10 * 60; // seconds
	const isActivityRecent = $derived.by(() => {
		const timestamp = metadata.statusCurrentActivityTimestamp;
		if (!timestamp) return false;
		const now = Math.floor(Date.now() / 1000);
		return (now - timestamp) < TEN_MINUTES;
	});

	// Show activity line only if there's current activity AND it's recent
	const showActivityLine = $derived(!!statusCurrentActivity && isActivityRecent);
	// Show summary when activity is stale or there's no activity
	const showSummary = $derived(!isActivityRecent || !statusCurrentActivity);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
	onpointerdown={handlePointerDown}
	onpointerup={handlePointerUp}
	onpointermove={handlePointerMove}
	onpointercancel={handlePointerCancel}
	onpointerleave={handlePointerCancel}
	oncontextmenu={(e) => e.preventDefault()}
	style="{indentStyle}{!isSelected && backgroundStyle ? backgroundStyle : ''}"
	class="w-full text-left px-3 hover:bg-muted transition-colors border-b border-border touch-none group {isSelected
		? 'bg-primary/10'
		: ''} {depth > 0 ? 'nested-thread' : ''} {isCompact ? 'py-2' : 'py-3'}"
>
	{#if isCompact}
		<!-- COMPACT MODE: For nested threads -->
		<div class="flex items-center gap-2">
			<!-- Collapse/expand toggle for items with children -->
			{#if hasChildren && onToggleCollapse}
				<button
					onclick={(e) => { e.stopPropagation(); onToggleCollapse(); }}
					onpointerdown={(e) => e.stopPropagation()}
					onpointerup={(e) => e.stopPropagation()}
					class="flex-shrink-0 w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
					title={isCollapsed ? `Expand ${childCount} nested conversation${childCount !== 1 ? 's' : ''}` : 'Collapse nested conversations'}
				>
					{#if isCollapsed}
						<ChevronRight class="w-3 h-3" />
					{:else}
						<ChevronDown class="w-3 h-3" />
					{/if}
				</button>
			{:else}
				<!-- Visual nesting indicator for leaf nodes -->
				<div class="flex-shrink-0 w-4 h-4 flex items-center justify-center text-muted-foreground opacity-50">
					<GitBranch class="w-3 h-3 rotate-180" />
				</div>
			{/if}

			<!-- Avatars: sender and recipient (overlapping) -->
			<div class="flex items-center flex-shrink-0 avatar-stack">
				<User.Root {ndk} pubkey={thread.pubkey}>
					<User.Avatar class="w-5 h-5 rounded-full ring-2 ring-background" />
				</User.Root>
				{#if recipientPubkey}
					<User.Root {ndk} pubkey={recipientPubkey}>
						<User.Avatar class="w-5 h-5 rounded-full ring-2 ring-background -ml-2" />
					</User.Root>
				{/if}
			</div>

			<!-- Summary or current activity -->
			<div class="flex-1 min-w-0">
				{#if showActivityLine && statusColor}
					<div class="flex items-center gap-1.5 text-xs" style="color: {statusColor}">
						<svg class="w-2 h-2 animate-pulse flex-shrink-0" fill="currentColor" viewBox="0 0 8 8">
							<circle cx="4" cy="4" r="3"/>
						</svg>
						<span class="truncate">{statusCurrentActivity}</span>
					</div>
				{:else if metadata.summary}
					<span class="text-xs text-muted-foreground italic truncate block">{metadata.summary}</span>
				{:else}
					<span class="text-xs text-muted-foreground truncate block">{title}</span>
				{/if}
			</div>

			<!-- Collapsed indicator showing child count -->
			{#if isCollapsed && childCount > 0}
				<span class="text-[10px] text-muted-foreground flex-shrink-0">
					+{childCount}
				</span>
			{/if}

			<TimeAgo timestamp={displayTime} class="text-[10px] text-muted-foreground flex-shrink-0" />
		</div>
	{:else}
		<!-- FULL MODE: For root threads -->
		<div class="flex items-center gap-2 mb-1">
			<!-- Collapse/expand toggle for items with children -->
			{#if hasChildren && onToggleCollapse}
				<button
					onclick={(e) => { e.stopPropagation(); onToggleCollapse(); }}
					onpointerdown={(e) => e.stopPropagation()}
					onpointerup={(e) => e.stopPropagation()}
					class="flex-shrink-0 w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
					title={isCollapsed ? `Expand ${childCount} nested conversation${childCount !== 1 ? 's' : ''}` : 'Collapse nested conversations'}
				>
					{#if isCollapsed}
						<ChevronRight class="w-4 h-4" />
					{:else}
						<ChevronDown class="w-4 h-4" />
					{/if}
				</button>
			{/if}
			<span class="font-medium text-sm text-foreground truncate">{title}</span>
			{#if statusLabel && statusColor}
				<span
					class="px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap"
					style="background-color: {statusColor.replace(')', ', 0.2)')}; color: {statusColor}; border-color: {statusColor.replace(')', ', 0.3)')}"
				>
					{statusLabel}
				</span>
			{/if}
		</div>
		{#if showActivityLine && statusColor}
			<!-- Recent activity: show current activity -->
			<div
				class="flex items-center gap-1.5 text-xs mb-2"
				style="color: {statusColor}"
			>
				<svg class="w-3 h-3 animate-pulse flex-shrink-0" fill="currentColor" viewBox="0 0 8 8">
					<circle cx="4" cy="4" r="3"/>
				</svg>
				<span class="truncate">{statusCurrentActivity}</span>
			</div>
		{:else if showSummary}
			<!-- Stale/no activity: show summary -->
			<ConversationMetadataDisplay
				conversationId={thread.id}
				showSummary={true}
				summaryClass="text-xs text-muted-foreground italic truncate mb-2"
			/>
			{#if !metadata.summary && latestReply}
				<div class="text-xs text-muted-foreground truncate mb-2">
					{latestReply.content.slice(0, 80)}{latestReply.content.length > 80 ? '...' : ''}
				</div>
			{/if}
		{/if}
		<div class="flex items-center gap-3 text-xs text-muted-foreground">
			<div class="flex items-center gap-1.5">
				<User.Root {ndk} pubkey={thread.pubkey}>
					<div class="flex items-center gap-1.5">
						<User.Avatar class="w-4 h-4 rounded-full" />
						{#if thread.pubkey !== ndk.$currentPubkey}
							<User.Name class="truncate max-w-[80px]" />
						{/if}
					</div>
				</User.Root>
				{#if recipientPubkey}
					<User.Root {ndk} pubkey={recipientPubkey}>
						<div class="flex items-center gap-1">
							<User.Avatar class="w-4 h-4 rounded-full" />
							<User.Name class="truncate max-w-[80px]" />
						</div>
					</User.Root>
				{/if}
				<!-- Nested conversations indicator (only for root threads with children) -->
				{#if hasChildren && childCount > 0}
					<span class="px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap bg-muted text-muted-foreground border border-border">
						{childCount} nested
					</span>
				{/if}
			</div>
			{#if hashtags.length > 0}
				{@const maxHashtags = 3}
				{@const displayedHashtags = hashtags.slice(0, maxHashtags)}
				{@const hasMore = hashtags.length > maxHashtags}
				<div class="flex items-center gap-1 flex-nowrap overflow-hidden">
					{#each displayedHashtags as tag}
						<span
							class="px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap flex-shrink-0"
							style="background-color: {generateColorFromString(tag, 65, 85)}; color: {generateColorFromString(tag, 65, 25)};"
						>
							#{tag}
						</span>
					{/each}
					{#if hasMore}
						<span class="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">+{hashtags.length - maxHashtags}</span>
					{/if}
				</div>
			{/if}
			<TimeAgo timestamp={displayTime} class="ml-auto" />
			{#if onarchive}
				<span
					onclick={(e) => { e.stopPropagation(); onarchive(); }}
					onpointerdown={(e) => e.stopPropagation()}
					onpointerup={(e) => e.stopPropagation()}
					onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onarchive(); } }}
					role="button"
					tabindex="0"
					class="h-5 w-5 flex items-center justify-center text-muted-foreground hover:text-destructive rounded hover:bg-muted transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
					title="Archive conversation"
					aria-label="Archive conversation"
				>
					<X class="h-3 w-3" />
				</span>
			{/if}
		</div>
	{/if}
</div>

<style>
	/* Nested thread styling */
	.nested-thread {
		position: relative;
		background-color: hsl(var(--muted) / 0.3);
	}

	.nested-thread::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 2px;
		background-color: hsl(var(--primary) / 0.3);
	}
</style>
