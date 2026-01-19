<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import type { Message } from '$lib/utils/messageUtils';
	import ChatActionsMenu from './ChatActionsMenu.svelte';

	interface Props {
		rootEvent?: NDKEvent | null;
		messages: Message[];
	}

	let { rootEvent, messages }: Props = $props();
</script>

{#if messages.length > 0 && rootEvent}
	<ChatActionsMenu {rootEvent} {messages} />
{/if}
