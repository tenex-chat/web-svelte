<script lang="ts">
	import { Terminal } from 'lucide-svelte';

	interface Props {
		command: string;
	}

	let { command }: Props = $props();

	// Truncate long commands for display
	const displayText = $derived.by(() => {
		const maxLength = 80;
		if (command.length <= maxLength) {
			return command;
		}
		return command.substring(0, maxLength) + '...';
	});
</script>

<div class="flex items-center gap-2 text-sm text-muted-foreground">
	<Terminal class="w-4 h-4 flex-shrink-0" />
	<span>Executing: <code class="px-1 py-0.5 bg-muted rounded text-xs">{displayText}</code></span>
</div>
