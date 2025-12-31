<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** Empty state title */
		title: string;
		/** Empty state description */
		description?: string;
		/** Icon component to display (lucide-svelte or similar) */
		icon?: any;
		/** Custom action slot */
		action?: Snippet;
	}

	let { title, description, icon: Icon, action }: Props = $props();
</script>

<div class="flex flex-col items-center justify-center h-64 text-center">
	{#if Icon}
		<Icon class="w-12 h-12 text-muted-foreground mb-2" />
	{/if}

	<h3 class="text-lg font-medium text-foreground">{title}</h3>

	{#if description}
		<p class="text-sm text-muted-foreground mt-1">{description}</p>
	{/if}

	{#if action}
		<div class="mt-4">
			{@render action()}
		</div>
	{/if}
</div>
