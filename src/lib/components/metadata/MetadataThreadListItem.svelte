<script lang="ts">
	import type { MetadataFeedItem } from '$lib/stores/metadataFeed.svelte';
	import { projectsStore } from '$lib/stores/projects.svelte';
	import { Activity } from 'lucide-svelte';
	import TimeAgo from '$lib/components/common/TimeAgo.svelte';
	import { cn } from '$lib/utils/cn';
	import { generateColorFromString } from '$lib/utils/colors';

	interface Props {
		item: MetadataFeedItem;
		isSelected: boolean;
		onclick: () => void;
	}

	const { item, isSelected, onclick }: Props = $props();

	// Get display title - fallback to conversation ID snippet
	const displayTitle = $derived(
		item.title || `Conversation ${item.conversationId.slice(0, 8)}...`
	);

	// Get status indicator color based on activity
	const hasActivity = $derived(!!item.statusCurrentActivity);

	// Get project from 'a' tag if present - lookup proper project name
	const projectTag = $derived(item.latestEvent?.tagValue('a'));
	const projectName = $derived.by(() => {
		if (!projectTag) return null;
		const parts = projectTag.split(':');
		if (parts.length < 3) return null;
		const dTag = parts[2];
		// Look up the project by dTag to get its proper title
		const project = projectsStore.projectsByDTag.get(dTag);
		return project?.title || dTag;
	});

	// Generate dynamic color from status label
	const statusColor = $derived(item.statusLabel ? generateColorFromString(item.statusLabel) : null);
</script>

<button
	{onclick}
	class={cn(
		"w-full text-left px-3 py-3 hover:bg-muted transition-colors border-b border-border relative",
		isSelected && 'bg-primary/10'
	)}
>
	<!-- Activity indicator -->
	{#if hasActivity}
		<div
			class="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500"
			style="box-shadow: 0 0 10px rgba(16, 185, 129, 0.6)"
		></div>
	{/if}

	<div class={cn("flex items-center gap-2 mb-1", hasActivity && "ml-2")}>
		<span class="font-medium text-sm text-foreground truncate flex-1">{displayTitle}</span>
		{#if item.statusLabel && statusColor}
			<span
				class="px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap"
				style="background-color: {statusColor.replace(')', ', 0.2)')}; color: {statusColor}; border-color: {statusColor.replace(')', ', 0.3)')}"
			>
				{item.statusLabel}
			</span>
		{/if}
	</div>

	<!-- Summary (always show if available) -->
	{#if item.summary}
		<div class={cn("text-xs text-muted-foreground mb-2 whitespace-pre-wrap", hasActivity && "ml-2")}>
			{item.summary}
		</div>
	{/if}

	<!-- Current activity indicator -->
	{#if item.statusCurrentActivity}
		<div class={cn("flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 mb-2", hasActivity && "ml-2")}>
			<Activity class="w-3 h-3 flex-shrink-0 animate-pulse" />
			<span>{item.statusCurrentActivity}</span>
		</div>
	{/if}

	<!-- Tags/categories as pills -->
	{#if item.tags.length > 0}
		<div class={cn("flex flex-wrap gap-1 mb-2", hasActivity && "ml-2")}>
			{#each item.tags as tag}
				<span class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
					{tag}
				</span>
			{/each}
		</div>
	{/if}

	<div class={cn("flex items-center gap-3 text-xs text-muted-foreground", hasActivity && "ml-2")}>
		{#if projectName}
			<span class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
				{projectName}
			</span>
		{/if}
		<TimeAgo timestamp={item.latestTimestamp} class="ml-auto" />
	</div>
</button>
