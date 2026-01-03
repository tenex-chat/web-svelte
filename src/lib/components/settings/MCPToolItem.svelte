<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { NDKMCPTool } from '$lib/events/NDKMCPTool';
	import { Trash } from 'lucide-svelte';

	interface Props {
		eventId: string;
		disabled?: boolean;
		onRemove: () => void;
	}

	let { eventId, disabled = false, onRemove }: Props = $props();

	// Subscribe to the specific tool event
	const toolSubscription = ndk.$subscribe(() => ({
		ids: [eventId]
	}));

	const tool = $derived.by(() => {
		const events = Array.from(toolSubscription.events || []);
		if (events.length === 0) return null;
		return NDKMCPTool.from(events[0]);
	});
</script>

<div class="p-4 border border-border rounded-lg bg-card">
	{#if tool}
		<div class="flex items-start justify-between gap-3">
			<div class="flex-1 min-w-0">
				<div class="font-medium text-foreground mb-1 font-mono text-sm">
					{tool.name || 'Unnamed Tool'}
				</div>
				{#if tool.description}
					<p class="text-sm text-muted-foreground line-clamp-2">
						{tool.description}
					</p>
				{/if}
				{#if tool.command}
					<div class="mt-2 text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
						{tool.command}
					</div>
				{/if}
			</div>
			<button
				onclick={onRemove}
				{disabled}
				class="p-2 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
				title="Remove tool"
				aria-label="Remove tool"
			>
				<Trash class="w-4 h-4" />
			</button>
		</div>
	{/if}
</div>
