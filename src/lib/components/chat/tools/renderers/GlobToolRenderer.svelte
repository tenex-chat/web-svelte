<script lang="ts">
	import { Search } from 'lucide-svelte';

	interface Props {
		pattern: string;
	}

	let { pattern }: Props = $props();
</script>

<div class="flex items-center gap-2 text-sm text-muted-foreground">
	<Search class="w-4 h-4 flex-shrink-0" />
	<span>Searching <code class="px-1 py-0.5 bg-muted rounded text-xs">{pattern}</code></span>
</div>
