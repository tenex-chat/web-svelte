<script lang="ts">
	import { FileText } from 'lucide-svelte';

	interface ReadPathArgs {
		path?: string;
	}

	interface Props {
		args: ReadPathArgs | null;
	}

	let { args }: Props = $props();

	const path = $derived(args?.path || '');
</script>

<div class="flex items-center gap-2 text-sm text-muted-foreground">
	<FileText class="w-4 h-4 flex-shrink-0" />
	<span>Reading <code class="px-1 py-0.5 bg-muted rounded text-xs">{path}</code></span>
</div>
