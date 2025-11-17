<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';

	interface Props {
		nudge: NDKEvent;
		isActive: boolean;
		isSelected: boolean;
		onclick: () => void;
		onmouseenter: () => void;
	}

	const { nudge, isActive, isSelected, onclick, onmouseenter }: Props = $props();

	const title = $derived(nudge.tagValue('title') || 'Untitled');
	const description = $derived(nudge.tagValue('description') || '');
</script>

<button
	type="button"
	{onclick}
	{onmouseenter}
	class="w-full px-3 py-2 text-left hover:bg-accent transition-colors {isSelected
		? 'bg-accent'
		: ''}"
>
	<div class="flex items-center gap-2">
		<div class="font-medium text-sm text-foreground">/{title}</div>
		{#if isActive}
			<span class="text-xs px-1.5 py-0.5 bg-primary/20 text-primary rounded">Active</span>
		{/if}
	</div>
	{#if description}
		<div class="text-xs text-muted-foreground mt-0.5">{description}</div>
	{/if}
</button>
