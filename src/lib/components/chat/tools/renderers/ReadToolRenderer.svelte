<script lang="ts">
	import { FileText } from 'lucide-svelte';

	interface Props {
		displayPath: string;
	}

	let { displayPath }: Props = $props();
</script>

<div class="flex items-center gap-2 text-sm text-muted-foreground">
	<FileText class="w-4 h-4 flex-shrink-0" />
	<span>Reading <code class="px-1 py-0.5 bg-muted rounded text-xs">{displayPath}</code></span>
</div>
