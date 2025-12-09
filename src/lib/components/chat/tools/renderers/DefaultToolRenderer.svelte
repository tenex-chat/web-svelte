<script lang="ts">
	import { Settings } from 'lucide-svelte';

	interface Props {
		toolName: string;
	}

	let { toolName }: Props = $props();
</script>

<div class="flex items-center gap-2 text-sm text-muted-foreground">
	<Settings class="w-4 h-4 flex-shrink-0" />
	<span>Executing {toolName}</span>
</div>
