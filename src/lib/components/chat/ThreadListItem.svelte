<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import { MessageSquare, AlertCircle } from 'lucide-svelte';
	import ConversationMetadataDisplay from './ConversationMetadataDisplay.svelte';
	import { conversationMetadataStore } from '$lib/stores/conversationMetadata.svelte';
	import TimeAgo from '$lib/components/common/TimeAgo.svelte';
	import { generateColorFromString } from '$lib/utils/colors';
	import { User } from '$lib/ndk/ui/user';
	import { ndk } from '$lib/ndk.svelte';
	import { isAskEvent } from '$lib/utils/askTags';

	interface ThreadMetadata {
		latestReply: NDKEvent | null;
		replyCount: number;
		participants: Set<string>;
		lastUserReplyTime: number;
		lastOtherReplyTime: number;
	}

	interface Props {
		thread: NDKEvent;
		isSelected: boolean;
		conversationMetadataStore: typeof conversationMetadataStore;
		threadMetadata: Map<string, ThreadMetadata>;
		onclick: () => void;
		onlongpress?: (position: { x: number; y: number }) => void;
	}

	const { thread, isSelected, conversationMetadataStore: conversationMetadataStoreProp, threadMetadata, onclick, onlongpress }: Props = $props();

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
	const replyCount = $derived(meta?.replyCount || 0);
	const displayTime = $derived(latestReply?.created_at || thread.created_at || 0);
	const hashtags = $derived(thread.tags.filter((tag) => tag[0] === 't').map((tag) => tag[1]));

	// Check if thread or latest reply is an ask (needs attention)
	const hasAsk = $derived(isAskEvent(thread) || (latestReply && isAskEvent(latestReply)));

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

<button
	onpointerdown={handlePointerDown}
	onpointerup={handlePointerUp}
	onpointermove={handlePointerMove}
	onpointercancel={handlePointerCancel}
	onpointerleave={handlePointerCancel}
	oncontextmenu={(e) => e.preventDefault()}
	style={!isSelected && backgroundStyle ? backgroundStyle : ''}
	class="w-full text-left px-3 py-3 hover:bg-muted transition-colors border-b border-border touch-none {isSelected
		? 'bg-primary/10'
		: ''}"
>
	<div class="flex items-center gap-2 mb-1">
		<span class="font-medium text-sm text-foreground truncate">{title}</span>
		{#if hasAsk}
			<span
				class="px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-700/50"
				title="This conversation has a question waiting for response"
			>
				<AlertCircle class="h-3 w-3" />
				Asking
			</span>
		{/if}
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
		<User.Root {ndk} pubkey={thread.pubkey}>
			<div class="flex items-center gap-1.5">
				<User.Avatar class="w-4 h-4 rounded-full" />
				<User.Name class="truncate max-w-[100px]" />
			</div>
		</User.Root>
		<div class="flex items-center gap-1">
			<MessageSquare class="w-3 h-3" />
			<span>{replyCount}</span>
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
	</div>
</button>
