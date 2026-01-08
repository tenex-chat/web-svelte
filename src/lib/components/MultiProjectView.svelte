<script lang="ts">
	import type { NDKProject } from '$lib/events/NDKProject';
	import ProjectColumn from './ProjectColumn.svelte';

	interface Props {
		projects: NDKProject[];
	}

	let { projects }: Props = $props();
</script>

{#each projects as project (project.dTag || project.id)}
	<ProjectColumn {project} />
{/each}
