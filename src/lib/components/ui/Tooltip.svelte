<script lang="ts">
	import { cn } from '$lib/utils/cn';

	interface Props {
		text: string;
		side?: 'top' | 'right' | 'bottom' | 'left';
		class?: string;
		children?: any;
	}

	let { text, side = 'top', class: className, children }: Props = $props();

	let showTooltip = $state(false);

	const sideClasses = {
		top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
		right: 'left-full top-1/2 -translate-y-1/2 ml-2',
		bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
		left: 'right-full top-1/2 -translate-y-1/2 mr-2'
	};
</script>

<div
	class={cn('relative block', className)}
	onmouseenter={() => (showTooltip = true)}
	onmouseleave={() => (showTooltip = false)}
>
	{@render children?.()}

	{#if showTooltip}
		<div
			class={cn(
				'absolute z-50 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded whitespace-nowrap pointer-events-none',
				sideClasses[side]
			)}
		>
			{text}
		</div>
	{/if}
</div>
