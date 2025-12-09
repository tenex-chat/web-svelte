<script lang="ts">
	import { Pencil, ChevronDown, ChevronRight } from 'lucide-svelte';
	import { Streamdown } from 'svelte-streamdown';

	interface Props {
		displayPath: string;
		content: string;
	}

	let { displayPath, content }: Props = $props();

	let expanded = $state(false);

	// Detect language from file extension
	const language = $derived.by(() => {
		const ext = displayPath.split('.').pop()?.toLowerCase();
		const langMap: Record<string, string> = {
			ts: 'typescript',
			tsx: 'tsx',
			js: 'javascript',
			jsx: 'jsx',
			svelte: 'svelte',
			css: 'css',
			scss: 'scss',
			html: 'html',
			json: 'json',
			md: 'markdown',
			py: 'python',
			rs: 'rust',
			go: 'go',
			sh: 'bash',
			yaml: 'yaml',
			yml: 'yaml'
		};
		return langMap[ext || ''] || 'text';
	});

	// Format content as a code block for rendering
	const formattedContent = $derived('```' + language + '\n' + content + '\n```');
</script>

<div class="text-sm">
	<button
		type="button"
		class="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
		onclick={() => (expanded = !expanded)}
	>
		{#if expanded}
			<ChevronDown class="w-4 h-4 flex-shrink-0" />
		{:else}
			<ChevronRight class="w-4 h-4 flex-shrink-0" />
		{/if}
		<Pencil class="w-4 h-4 flex-shrink-0" />
		<span>Writing <code class="px-1 py-0.5 bg-muted rounded text-xs">{displayPath}</code></span>
	</button>

	{#if expanded}
		<div class="mt-2 ml-6 max-h-96 overflow-auto rounded border border-border">
			<Streamdown
				content={formattedContent}
				class="prose prose-sm max-w-none dark:prose-invert text-foreground"
				baseTheme="shadcn"
				shikiTheme="github-dark-dimmed"
			/>
		</div>
	{/if}
</div>
