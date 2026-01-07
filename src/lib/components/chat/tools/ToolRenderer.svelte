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
	import ReadPathToolRenderer from './renderers/ReadPathToolRenderer.svelte';
	import WriteToolRenderer from './renderers/WriteToolRenderer.svelte';
	import GlobToolRenderer from './renderers/GlobToolRenderer.svelte';
	import BashToolRenderer from './renderers/BashToolRenderer.svelte';
	import ShellToolRenderer from './renderers/ShellToolRenderer.svelte';
	import TodoWriteToolRenderer from './renderers/TodoWriteToolRenderer.svelte';
	import TodoAddToolRenderer from './renderers/TodoAddToolRenderer.svelte';
	import TodoUpdateToolRenderer from './renderers/TodoUpdateToolRenderer.svelte';
	import LessonLearnToolRenderer from './renderers/LessonLearnToolRenderer.svelte';
	import CodebaseSearchToolRenderer from './renderers/CodebaseSearchToolRenderer.svelte';
	import DelegateToolRenderer from './renderers/DelegateToolRenderer.svelte';
	import DelegateExternalToolRenderer from './renderers/DelegateExternalToolRenderer.svelte';
import ScheduleTaskRenderer from './renderers/ScheduleTaskRenderer.svelte';
import ReportWriteToolRenderer from './renderers/ReportWriteToolRenderer.svelte';

	interface Props {
		event: NDKEvent;
	}

	let { event }: Props = $props();

	const toolName = $derived(getToolName(event));
	const args = $derived(parseToolArgs(event));
	const projectDTag = $derived(extractProjectDTag(event));
	const branch = $derived(extractBranch(event));
	const hasDelegations = $derived(event.getMatchingTags('q').length > 0);

	// Helper to extract document "a" tag (kind 30023)
	function extractDocumentATag(event: NDKEvent): string | null {
		const aTag = event.tags.find((tag) => tag[0] === 'a' && tag[1]?.startsWith('30023:'));
		return aTag?.[1] || null;
	}

	// Helper to extract project "a" tag (kind 31933)
	function extractProjectATag(event: NDKEvent): string | null {
		const aTag = event.tags.find((tag) => tag[0] === 'a' && tag[1]?.startsWith('31933:'));
		return aTag?.[1] || null;
	}

	const documentATag = $derived(extractDocumentATag(event));
	const projectATag = $derived(extractProjectATag(event));

	// Helper to get display path for file-based tools
	function getFilePath(argName: string): string {
		const fullPath = args?.[argName] as string | undefined;
		if (!fullPath) return '';
		return getDisplayPath(fullPath, projectDTag, branch);
	}
</script>

{#if toolName === 'Read'}
	<ReadToolRenderer displayPath={getFilePath('file_path')} />
{:else if toolName === 'read_path'}
	<ReadPathToolRenderer {args} />
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
{:else if toolName === 'todo_add'}
	<TodoAddToolRenderer
		items={(args?.items as Array<{title: string; description?: string}>) || []}
		content={event.content}
	/>
{:else if toolName === 'todo_update'}
	<TodoUpdateToolRenderer
		items={(args?.items as Array<{id: string; status?: string; title?: string; description?: string}>) || []}
		content={event.content}
	/>
{:else if toolName === 'lesson_learn'}
	<LessonLearnToolRenderer {args} />
{:else if toolName === 'codebase_search'}
	<CodebaseSearchToolRenderer {args} />
{:else if toolName === 'schedule_task'}
	<ScheduleTaskRenderer {args} />
{:else if toolName === 'report_write'}
	<ReportWriteToolRenderer
		title={(args?.title as string) || 'Untitled Report'}
		{documentATag}
		{projectATag}
	/>
{:else if hasDelegations}
	<DelegateToolRenderer {event} />
{:else if toolName === 'delegate_external'}
	<DelegateExternalToolRenderer {args} />
{:else if toolName}
	<DefaultToolRenderer {toolName} content={event.content} />
{/if}
