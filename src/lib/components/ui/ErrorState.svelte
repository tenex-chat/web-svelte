<script lang="ts">
	import { AlertCircle } from 'lucide-svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		/** Error title */
		title?: string;
		/** Error message to display */
		message?: string;
		/** Retry callback */
		onRetry?: () => void;
		/** Custom icon slot */
		icon?: Snippet;
		/** Custom action slot */
		action?: Snippet;
	}

	let {
		title = 'Something went wrong',
		message,
		onRetry,
		icon,
		action
	}: Props = $props();
</script>

<div class="flex flex-col items-center justify-center py-8 text-center h-full">
	{#if icon}
		{@render icon()}
	{:else}
		<AlertCircle class="h-12 w-12 text-destructive mb-4" />
	{/if}

	<h3 class="text-lg font-medium text-foreground mb-1">{title}</h3>

	{#if message}
		<p class="text-sm text-muted-foreground mb-4 max-w-md">{message}</p>
	{/if}

	{#if action}
		{@render action()}
	{:else if onRetry}
		<button
			onclick={onRetry}
			class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm"
		>
			Try Again
		</button>
	{/if}
</div>
