<script lang="ts">
	import { MessageSquare, FileText, Hash, Bot, Phone } from 'lucide-svelte';
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import { Avatar } from '@nostr-dev-kit/svelte';
	import { ndk } from '$lib/ndk.svelte';
	import { formatRelativeTime } from '$lib/utils/time';

	interface Props {
		event: NDKEvent;
		onclick?: () => void;
	}

	let { event, onclick }: Props = $props();

	// Fetch author profile using NDK's built-in utility
	const profile = ndk.$fetchProfile(() => event.pubkey);

	// Get author display name (fallback to truncated pubkey)
	const authorName = $derived(
		profile?.name || profile?.displayName || profile?.display_name || event.pubkey.slice(0, 8) + '...' + event.pubkey.slice(-4)
	);

	// Determine event type and rendering details based on actual kind
	const eventDetails = $derived.by(() => {
		switch (event.kind) {
			case 1: // kind 1 - text note
				return {
					icon: MessageSquare,
					label: 'Note',
					title:
						event.content.length > 100 ? event.content.slice(0, 100) + '...' : event.content
				};

			case 30023: // kind 30023 - long-form content
				return {
					icon: FileText,
					label: 'Article',
					title: event.tagValue('title') || event.tagValue('name') || 'Untitled'
				};

			case 1111: // kind 1111 - generic reply
				return {
					icon: MessageSquare,
					label: 'Reply',
					title:
						event.content.length > 100 ? event.content.slice(0, 100) + '...' : event.content
				};

			case 29000: // kind 29000 - call event
				return {
					icon: Phone,
					label: 'Call',
					title: event.tagValue('subject') || 'Voice Call'
				};

			case 1905: // kind 1905 - agent event
			case 31905: // kind 31905 - agent definition
				return {
					icon: Bot,
					label: 'Agent',
					title: event.tagValue('name') || 'Agent Activity'
				};

			default:
				return {
					icon: Hash,
					label: `Kind ${event.kind}`,
					title: event.content?.slice(0, 100) || 'Event'
				};
		}
	});

	// Get hashtags for the event
	const hashtags = $derived(
		event.tags
			.filter((tag) => tag[0] === 't')
			.map((tag) => tag[1])
			.slice(0, 3)
	);
</script>

<button
	type="button"
	class="w-full px-3 py-3 hover:bg-muted cursor-pointer transition-colors border-b border-border text-left"
	onclick={onclick}
>
	<div class="flex gap-3">
		<!-- Author Avatar -->
		<Avatar {ndk} pubkey={event.pubkey} size={36} />

		<!-- Content -->
		<div class="flex-1 min-w-0">
			<!-- Header -->
			<div class="flex items-center gap-2 mb-1">
				<span class="font-medium text-sm text-foreground">{authorName}</span>
				<div class="flex items-center gap-1.5 text-xs text-muted-foreground">
					<svelte:component this={eventDetails.icon} class="h-3.5 w-3.5" />
					<span>{eventDetails.label}</span>
					<span>·</span>
					<span>{formatRelativeTime(event.created_at || 0)}</span>
				</div>
			</div>

			<!-- Title/Preview - Shows actual event content -->
			<div class="text-sm text-foreground break-words line-clamp-2">
				{eventDetails.title}
			</div>

			<!-- Hashtags if present -->
			{#if hashtags.length > 0}
				<div class="flex items-center gap-2 mt-1.5 flex-wrap">
					{#each hashtags as tag (tag)}
						<div class="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
							<Hash class="h-2.5 w-2.5" />
							<span>{tag}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</button>
