<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import { MessageSquare, Users } from 'lucide-svelte';
	import ConversationMetadataDisplay from './ConversationMetadataDisplay.svelte';
	import { conversationMetadataStore } from '$lib/stores/conversationMetadata.svelte';
	import type { SvelteMap } from 'svelte/reactivity';
	import TimeAgo from '$lib/components/common/TimeAgo.svelte';
	import { generateColorFromString } from '$lib/utils/colors';

	interface ThreadMetadata {
		latestReply: NDKEvent | null;
		replyCount: number;
		participants: Set<string>;
	}

	interface Props {
		thread: NDKEvent;
		isSelected: boolean;
		conversationMetadataStore: typeof conversationMetadataStore;
		threadMetadata: SvelteMap<string, ThreadMetadata>;
		onclick: () => void;
	}

	const { thread, isSelected, conversationMetadataStore: conversationMetadataStoreProp, threadMetadata, onclick }: Props = $props();

	const metadata = $derived(conversationMetadataStoreProp.getConversationData(thread.id));
	const title = $derived(metadata.title || thread.tagValue('title') || thread.content?.slice(0, 50) || 'Untitled');
	const meta = $derived(threadMetadata.get(thread.id));
	const latestReply = $derived(meta?.latestReply);
	const replyCount = $derived(meta?.replyCount || 0);
	const participantCount = $derived(meta?.participants.size || 0);
	const displayTime = $derived(latestReply?.created_at || thread.created_at || 0);
	const hashtags = $derived(thread.tags.filter((tag) => tag[0] === 't').map((tag) => tag[1]));

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
</script>

<button
	{onclick}
	style={!isSelected && backgroundStyle ? backgroundStyle : ''}
	class="w-full text-left px-3 py-3 hover:bg-muted transition-colors border-b border-border {isSelected
		? 'bg-primary/10'
		: ''}"
>
	<div class="font-medium text-sm text-foreground truncate mb-1">
		{title}
	</div>
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
	<div class="flex items-center gap-3 text-xs text-muted-foreground">
		<div class="flex items-center gap-1">
			<MessageSquare class="w-3 h-3" />
			<span>{replyCount}</span>
		</div>
		<div class="flex items-center gap-1">
			<Users class="w-3 h-3" />
			<span>{participantCount}</span>
		</div>
		{#if hashtags.length > 0}
			<div class="flex items-center gap-1 flex-wrap">
				{#each hashtags as tag}
					<span
						class="px-1.5 py-0.5 rounded text-[10px] font-medium"
						style="background-color: {generateColorFromString(tag, 65, 85)}; color: {generateColorFromString(tag, 65, 25)};"
					>
						#{tag}
					</span>
				{/each}
			</div>
		{/if}
		<TimeAgo timestamp={displayTime} class="ml-auto" />
	</div>
</button>
