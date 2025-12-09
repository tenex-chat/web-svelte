<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import ToolRenderer from './tools/ToolRenderer.svelte';

	interface Props {
		event: NDKEvent;
	}

	let { event }: Props = $props();
</script>

<ToolRenderer {event} />
