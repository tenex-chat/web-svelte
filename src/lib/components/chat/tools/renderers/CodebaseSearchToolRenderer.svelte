<script lang="ts">
	import { Search } from 'lucide-svelte';

	interface CodebaseSearchArgs {
		query?: string;
		searchType?: string;
		fileType?: string;
		maxResults?: number;
		includeSnippets?: boolean;
	}

	interface Props {
		args: CodebaseSearchArgs | null;
	}

	let { args }: Props = $props();

	const query = $derived(args?.query || '');
	const searchType = $derived(args?.searchType || 'both');
	const fileType = $derived(args?.fileType || '');
</script>

<div class="flex items-center gap-2 text-sm text-muted-foreground">
	<Search class="w-4 h-4 flex-shrink-0" />
	<span>
		Searching codebase for <code class="px-1 py-0.5 bg-muted rounded text-xs">{query}</code>
		{#if fileType}
			<span class="text-xs">in <code class="px-1 py-0.5 bg-muted rounded text-xs">.{fileType}</code> files</span>
		{/if}
		<span class="text-xs">({searchType})</span>
	</span>
</div>
