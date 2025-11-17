<script lang="ts">
	import type { NDKProject } from '$lib/events/NDKProject';
	import { cn } from '$lib/utils/cn';
	import { generateColorFromString } from '$lib/utils/colors';
	import { projectStatusStore } from '$lib/stores/projectStatus.svelte';
	import { openProjects } from '$lib/stores/openProjects.svelte';

	interface Props {
		project: NDKProject;
		collapsed: boolean;
		onmousedown: (e: MouseEvent) => void;
		onmouseup: () => void;
		onmouseleave: () => void;
	}

	const { project, collapsed, onmousedown, onmouseup, onmouseleave }: Props = $props();

	const projectId = $derived(project.tagId());
	const isOnline = $derived(projectStatusStore.isProjectOnline(projectId));
	const isOpen = $derived(openProjects.isOpen(project));
	const projectColor = $derived(generateColorFromString(project.dTag || ''));
</script>

<button
	{onmousedown}
	{onmouseup}
	{onmouseleave}
	class={cn(
		'w-full text-left px-3 py-2 rounded-lg transition-all flex items-center gap-2',
		isOpen ? 'bg-primary/10 border border-primary/20 text-primary' : 'hover:bg-muted text-foreground',
		!isOnline && 'opacity-75'
	)}
	aria-label={collapsed ? (project.title || 'Untitled') : undefined}
	title={collapsed ? (project.title || 'Untitled') : undefined}
>
	<!-- Project Avatar -->
	<div class="relative flex-shrink-0">
		<div
			class="rounded-lg flex items-center justify-center text-white font-semibold w-8 h-8 text-sm"
			style="background: {projectColor}"
		>
			{project.title?.charAt(0).toUpperCase() || 'P'}
		</div>
		{#if isOnline}
			<div
				class="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-500 border border-card"
			></div>
		{/if}
	</div>

	{#if !collapsed}
		<div class="flex-1 min-w-0">
			<div class="font-medium text-sm truncate">{project.title || 'Untitled'}</div>
			<div class="text-xs text-muted-foreground">
				{project.agents.length} agents
			</div>
		</div>

		{#if isOpen}
			<svg class="w-3.5 h-3.5 flex-shrink-0 text-primary" fill="currentColor" viewBox="0 0 20 20">
				<path
					fill-rule="evenodd"
					d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
					clip-rule="evenodd"
				/>
			</svg>
		{/if}
	{/if}
</button>
