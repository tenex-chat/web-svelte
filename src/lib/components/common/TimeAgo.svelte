<script lang="ts">
	import { createTimeAgo } from '$lib/ndk/utils/time-ago/index.svelte';
	import { cn } from '$lib/ndk/utils/cn';

	interface Props {
		timestamp: number;
		class?: string;
	}

	let { timestamp, class: className = '' }: Props = $props();

	const timeAgo = createTimeAgo(timestamp);
	const datetime = $derived(timestamp ? new Date(timestamp * 1000).toISOString() : undefined);
</script>

<time datetime={datetime} class={cn(className)}>
	{timeAgo}
</time>
