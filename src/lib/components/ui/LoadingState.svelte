<script lang="ts">
	import Spinner from './Spinner.svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		/** Loading message to display */
		message?: string;
		/** Size of the spinner */
		spinnerSize?: 'sm' | 'md' | 'lg';
		/** Whether to center the loading state */
		centered?: boolean;
		/** Custom content slot */
		children?: Snippet;
	}

	let {
		message = 'Loading...',
		spinnerSize = 'md',
		centered = true,
		children
	}: Props = $props();
</script>

<div
	class="flex flex-col items-center gap-3 py-8"
	class:justify-center={centered}
	class:h-full={centered}
>
	<Spinner size={spinnerSize} />
	{#if children}
		{@render children()}
	{:else if message}
		<p class="text-sm text-muted-foreground">{message}</p>
	{/if}
</div>
