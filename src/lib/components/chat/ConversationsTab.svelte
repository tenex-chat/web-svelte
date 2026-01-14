<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import type { NDKProject } from '$lib/events/NDKProject';
	import { windowManager } from '$lib/stores/windowManager.svelte';
	import ThreadList from './ThreadList.svelte';

	interface Props {
		project: NDKProject;
	}

	let { project }: Props = $props();

	function handleThreadSelect(thread: NDKEvent | null) {
		if (thread) {
			windowManager.openChat(project, thread);
		} else {
			// New conversation
			windowManager.openChat(project);
		}
	}

	function handleThreadLongPress(thread: NDKEvent, position: { x: number; y: number }) {
		// Long-press opens the conversation as a detached (floating) window
		windowManager.openChatDetached(project, thread, position);
	}
</script>

<div class="h-full flex flex-col">
	<ThreadList {project} onThreadSelect={handleThreadSelect} onThreadLongPress={handleThreadLongPress} />
</div>
