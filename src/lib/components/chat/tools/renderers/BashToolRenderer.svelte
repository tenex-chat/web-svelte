<script lang="ts">
	import { Terminal } from 'lucide-svelte';

	interface Props {
		command: string;
		description: string | null;
	}

	let { command, description }: Props = $props();

	// Truncate command for display if no description provided
	const displayText = $derived.by(() => {
		if (description) {
			return description;
		}
		// Truncate long commands
		const maxLength = 60;
		if (command.length <= maxLength) {
			return command;
		}
		return command.substring(0, maxLength) + '...';
	});
</script>

<div class="flex items-center gap-2 text-sm text-muted-foreground">
	<Terminal class="w-4 h-4 flex-shrink-0" />
	<span>{displayText}</span>
</div>
