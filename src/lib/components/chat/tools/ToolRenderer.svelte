<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import {
		getToolName,
		parseToolArgs,
		extractProjectDTag,
		extractBranch,
		getDisplayPath
	} from '$lib/utils/toolPaths';
	import DefaultToolRenderer from './renderers/DefaultToolRenderer.svelte';
	import ReadToolRenderer from './renderers/ReadToolRenderer.svelte';
	import WriteToolRenderer from './renderers/WriteToolRenderer.svelte';
	import GlobToolRenderer from './renderers/GlobToolRenderer.svelte';
	import BashToolRenderer from './renderers/BashToolRenderer.svelte';
	import ShellToolRenderer from './renderers/ShellToolRenderer.svelte';
	import TodoWriteToolRenderer from './renderers/TodoWriteToolRenderer.svelte';

	interface Props {
		event: NDKEvent;
	}

	let { event }: Props = $props();

	const toolName = $derived(getToolName(event));
	const args = $derived(parseToolArgs(event));
	const projectDTag = $derived(extractProjectDTag(event));
	const branch = $derived(extractBranch(event));

	// Helper to get display path for file-based tools
	function getFilePath(argName: string): string {
		const fullPath = args?.[argName] as string | undefined;
		if (!fullPath) return '';
		return getDisplayPath(fullPath, projectDTag, branch);
	}
</script>

{#if toolName === 'Read'}
	<ReadToolRenderer displayPath={getFilePath('file_path')} />
{:else if toolName === 'Write'}
	<WriteToolRenderer displayPath={getFilePath('file_path')} content={(args?.content as string) || ''} />
{:else if toolName === 'Edit'}
	<ReadToolRenderer displayPath={getFilePath('file_path')} />
{:else if toolName === 'Glob'}
	<GlobToolRenderer pattern={(args?.pattern as string) || '**/*'} />
{:else if toolName === 'Grep'}
	<GlobToolRenderer pattern={(args?.pattern as string) || ''} />
{:else if toolName === 'Bash'}
	<BashToolRenderer
		command={(args?.command as string) || ''}
		description={(args?.description as string) || null}
	/>
{:else if toolName === 'shell'}
	<ShellToolRenderer command={(args?.command as string) || ''} />
{:else if toolName === 'TodoWrite'}
	<TodoWriteToolRenderer todos={(args?.todos as Array<{content: string; status: 'pending' | 'in_progress' | 'completed'; activeForm: string}>) || []} />
{:else if toolName}
	<DefaultToolRenderer {toolName} />
{/if}
