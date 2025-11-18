<script lang="ts">
	import ndk from '$lib/ndk.svelte';
	import { NDKMCPTool } from '$lib/events/NDKMCPTool';
	import { NDKKind } from '$lib/kinds';
	import { SvelteSet } from 'svelte/reactivity';
	import { cn } from '$lib/utils/cn';

	interface Props {
		selectedTools: SvelteSet<NDKMCPTool>;
	}

	let { selectedTools = $bindable(new SvelteSet()) }: Props = $props();

	// Subscribe to all MCP tools
	const toolsSubscription = ndk.$subscribe(() => ({
		filters: [{ kinds: [NDKKind.MCPTool as number] }],
		closeOnEose: true
	}));

	const tools = $derived(
		toolsSubscription.events.map(event => NDKMCPTool.from(event))
	);

	function toggleTool(tool: NDKMCPTool) {
		const newSelected = new SvelteSet(selectedTools);

		// Check if tool is already selected (compare by id)
		const existing = Array.from(newSelected).find(t => t.id === tool.id);

		if (existing) {
			newSelected.delete(existing);
		} else {
			newSelected.add(tool);
		}

		selectedTools = newSelected;
	}

	function isSelected(tool: NDKMCPTool): boolean {
		return Array.from(selectedTools).some(t => t.id === tool.id);
	}
</script>

<div class="border border-border rounded-lg p-4">
	{#if tools.length === 0}
		<p class="text-center text-muted-foreground py-8">
			No MCP tools available
		</p>
	{:else}
		<div class="space-y-2">
			{#each tools as tool (tool.id)}
				<button
					onclick={() => toggleTool(tool)}
					class={cn(
						'w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left',
						isSelected(tool)
							? 'bg-accent border-primary'
							: 'border-border hover:bg-accent'
					)}
				>
					<div class="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
						<svg class="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
							/>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
							/>
						</svg>
					</div>

					<div class="flex-1 min-w-0">
						<p class="font-medium">
							{tool.name || 'Unnamed Tool'}
						</p>
						<p class="text-sm text-muted-foreground truncate">
							{tool.description || 'No description'}
						</p>
						{#if tool.command}
							<code class="text-xs bg-muted px-1 py-0.5 rounded">
								{tool.command}
							</code>
						{/if}
					</div>

					{#if isSelected(tool)}
						<svg class="w-5 h-5 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M5 13l4 4L19 7"
							/>
						</svg>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>
