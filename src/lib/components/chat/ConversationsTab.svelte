<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import type { NDKProject } from '$lib/events/NDKProject';
	import type { ProjectAgent } from '$lib/events/NDKProjectStatus';
	import { windowManager } from '$lib/stores/windowManager.svelte';
	import ThreadList from './ThreadList.svelte';

	interface Props {
		project: NDKProject;
		onlineAgents?: ProjectAgent[];
		timeFilter?: string | null;
	}

	let { project, onlineAgents = [], timeFilter = null }: Props = $props();

	function handleThreadSelect(thread: NDKEvent | null) {
		if (thread) {
			windowManager.openChat(project, thread);
		} else {
			// New conversation
			windowManager.openChat(project);
		}
	}
</script>

<div class="h-full flex flex-col">
	<ThreadList {project} {timeFilter} onThreadSelect={handleThreadSelect} />
</div>
