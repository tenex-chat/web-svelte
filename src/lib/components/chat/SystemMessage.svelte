<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';

	interface Props {
		event: NDKEvent;
	}

	let { event }: Props = $props();

	// Extract summary from metadata event
	const summaryTag = $derived(event.tags.find((tag) => tag[0] === 'summary'));
	const summaryText = $derived(summaryTag ? summaryTag[1] : null);

	// Format timestamp
	const timestamp = $derived.by(() => {
		if (!event.created_at) return '';
		const date = new Date(event.created_at * 1000);
		return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
	});
</script>

{#if summaryText}
	<div class="px-4 py-3 flex justify-center">
		<div class="max-w-2xl px-4 py-2 bg-muted/50 rounded-lg text-center">
			<div class="text-xs text-muted-foreground font-medium mb-1">Conversation Summary</div>
			<div class="text-sm text-muted-foreground italic">{summaryText}</div>
			<div class="text-xs text-muted-foreground/70 mt-1">{timestamp}</div>
		</div>
	</div>
{/if}
