<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import { User } from '$lib/ndk/ui/user';
	import { ndk } from '$lib/ndk.svelte';
	import { formatRelativeTime } from '$lib/utils/time';
	import { cn } from '$lib/utils/cn';
	import { Streamdown } from 'svelte-streamdown';
	import {
		Bot,
		MessageCircle,
		Reply,
		Heart,
		FileText,
		ChevronRight,
		HelpCircle,
		ChevronDown
	} from 'lucide-svelte';

	interface Props {
		event: NDKEvent;
		isUnread?: boolean;
	}

	let { event, isUnread = false }: Props = $props();

	let isExpanded = $state(false);

	// Get event type info
	const eventTypeInfo = $derived.by(() => {
		switch (event.kind) {
			case 1:
				return { icon: MessageCircle, label: 'Mention', color: 'text-blue-500' };
			case 1111: {
				// Check if this is from an agent
				const isAgentResponse =
					event.tags.some((tag) => tag[0] === 'client') ||
					event.tags.some((tag) => tag[0] === 'p' && tag[3] === 'agent');
				return isAgentResponse
					? { icon: Bot, label: 'Agent Response', color: 'text-purple-500' }
					: { icon: Reply, label: 'Reply', color: 'text-green-500' };
			}
			case 7:
				return { icon: Heart, label: 'Reaction', color: 'text-pink-500' };
			case 30023:
				return { icon: FileText, label: 'Article Mention', color: 'text-orange-500' };
			default:
				return { icon: MessageCircle, label: 'Event', color: 'text-gray-500' };
		}
	});

	// Get content preview
	const contentPreview = $derived(
		event.content?.substring(0, 150) + (event.content?.length > 150 ? '...' : '')
	);

	// Get suggestions
	const suggestions = $derived(
		event.tags.filter((tag) => tag[0] === 'suggestion').map((tag) => tag[1]).filter(Boolean)
	);

	const hasSuggestions = $derived(suggestions.length > 0);

	// Format timestamp
	const timeAgo = $derived(event.created_at ? formatRelativeTime(event.created_at) : 'Unknown time');
</script>

<div
	class={cn(
		'relative flex gap-3 p-4 transition-colors group',
		isUnread && 'bg-primary/5'
	)}
>
	{#if isUnread}
		<div
			class="absolute left-0 top-0 bottom-0 w-1 bg-primary"
			style="box-shadow: 0 0 15px rgba(59, 130, 246, 0.8)"
			aria-label="New message indicator"
		></div>
		<div
			class="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-r from-primary/30 to-transparent"
			aria-hidden="true"
		></div>
	{/if}

	<!-- Avatar -->
	<User.Root {ndk} pubkey={event.pubkey}>
		<div class={cn('flex-shrink-0', isUnread && 'ml-3')}>
			<User.Avatar class="w-10 h-10 rounded-full" />
		</div>

		<!-- Main content -->
		<div class="flex-1 min-w-0">
			<!-- Header -->
			<div class="flex items-start justify-between mb-1">
				<div class="flex items-center gap-2 flex-wrap">
					<div class="flex items-center gap-1">
						<User.Name class="font-medium text-sm" />
					</div>
				{#snippet iconBadge()}
					{@const Icon = eventTypeInfo.icon}
					<Icon class="h-3 w-3" />
				{/snippet}
				<div class={cn('flex items-center gap-1', eventTypeInfo.color)}>
					{@render iconBadge()}
					<span class="text-xs">{eventTypeInfo.label}</span>
				</div>
				{#if isUnread}
					<span
						class="px-2 py-0.5 text-xs font-medium bg-primary text-primary-foreground rounded-full animate-pulse shadow-lg"
					>
						New
					</span>
				{/if}
			</div>
			<span class="text-xs text-muted-foreground whitespace-nowrap">{timeAgo}</span>
		</div>

		<!-- Content -->
		<div class="text-sm text-muted-foreground">
			{#if isExpanded}
				<div class="prose prose-sm max-w-none dark:prose-invert text-muted-foreground">
					<Streamdown
						content={event.content}
						class="prose prose-sm max-w-none dark:prose-invert text-muted-foreground"
						parseIncompleteMarkdown={true}
						animation={{ enabled: false }}
						baseTheme="shadcn"
						shikiTheme="github-dark-dimmed"
					/>
				</div>
			{:else}
				<div class="prose prose-sm max-w-none dark:prose-invert text-muted-foreground line-clamp-2">
					<Streamdown
						content={contentPreview}
						class="prose prose-sm max-w-none dark:prose-invert text-muted-foreground"
						parseIncompleteMarkdown={true}
						animation={{ enabled: false }}
						baseTheme="shadcn"
						shikiTheme="github-dark-dimmed"
					/>
				</div>
			{/if}
		</div>

		<!-- Suggestions Preview -->
		{#if hasSuggestions}
			<div class="mt-2 flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-md">
				<HelpCircle class="h-4 w-4 text-primary animate-pulse" />
				<div class="flex items-center gap-2 text-xs">
					<span class="text-foreground font-medium">
						{suggestions.length}
						{suggestions.length === 1 ? 'option' : 'options'}
					</span>
					<ChevronDown class="h-3 w-3 text-muted-foreground" />
				</div>
				<span class="ml-auto text-xs text-primary font-medium">Waiting for response</span>
			</div>
		{/if}

		<!-- Action buttons (shown on hover) -->
		<div class="mt-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
			<button
				onclick={(e) => {
					e.stopPropagation();
					isExpanded = !isExpanded;
				}}
				class="h-7 px-3 text-xs rounded-md hover:bg-muted flex items-center gap-1"
			>
				{isExpanded ? 'Collapse' : 'View Context'}
				<ChevronRight class="ml-1 h-3 w-3" />
			</button>
		</div>
	</div>
	</User.Root>
</div>
