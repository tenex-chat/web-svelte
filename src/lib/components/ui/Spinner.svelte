<script lang="ts">
	import { Loader2 } from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		/** Size of the spinner: 'sm' = 16px, 'md' = 24px, 'lg' = 32px */
		size?: 'sm' | 'md' | 'lg';
		/** Additional CSS classes */
		class?: string;
	}

	let { size = 'md', class: className }: Props = $props();

	const sizeClasses = {
		sm: 'h-4 w-4',
		md: 'h-6 w-6',
		lg: 'h-8 w-8'
	};
</script>

<Loader2 class={cn('animate-spin text-muted-foreground', sizeClasses[size], className)} />
