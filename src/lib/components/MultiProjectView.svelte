<script lang="ts">
	import type { NDKProject } from '$lib/events/NDKProject';
	import ProjectColumn from './ProjectColumn.svelte';

	interface Props {
		projects: NDKProject[];
	}

	let { projects }: Props = $props();
</script>

<div class="flex h-full overflow-x-auto">
	{#each projects as project (project.dTag || project.id)}
		<ProjectColumn {project} />
	{/each}
</div>
