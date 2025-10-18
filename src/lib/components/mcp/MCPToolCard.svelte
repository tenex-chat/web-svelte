<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { NDKMCPTool } from '$lib/events/NDKMCPTool';
	import { goto } from '$app/navigation';
	import { Pencil, Trash } from 'lucide-svelte';

	interface Props {
		tool: NDKMCPTool;
		onEdit?: (tool: NDKMCPTool) => void;
	}

	let { tool, onEdit }: Props = $props();

	const isOwner = $derived(tool.pubkey === ndk.$currentUser?.pubkey);

	function getToolIcon(command?: string): string {
		if (!command) return '🛠️';
		if (command.includes('mcp')) return '⚙️';
		if (command.includes('code')) return '💻';
		return '🛠️';
	}

	function handleCardClick(e: MouseEvent) {
		// Don't navigate if clicking on action buttons
		if ((e.target as HTMLElement).closest('button')) {
			return;
		}
		goto(`/tools/${tool.id}`);
	}

	function handleEdit(e: MouseEvent) {
		e.stopPropagation();
		onEdit?.(tool);
	}

	async function handleDelete(e: MouseEvent) {
		e.stopPropagation();
		if (!confirm(`Are you sure you want to delete "${tool.name}"?`)) {
			return;
		}

		try {
			const deleteEvent = await tool.delete();
			if (deleteEvent) {
				await deleteEvent.publish();
			}
		} catch (error) {
			console.error('Failed to delete tool:', error);
			alert('Failed to delete tool. Please try again.');
		}
	}
</script>

<div
	class="bg-card border border-border rounded-lg p-4 hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-md transition-all cursor-pointer"
	onclick={handleCardClick}
	role="button"
	tabindex="0"
	onkeydown={(e) => e.key === 'Enter' && handleCardClick(e as any)}
>
	<!-- Header -->
	<div class="flex items-start justify-between mb-3">
		<div class="flex items-center gap-2 flex-1 min-w-0">
			<span class="text-2xl flex-shrink-0">{getToolIcon(tool.command)}</span>
			<div class="min-w-0 flex-1">
				<h3 class="font-semibold text-foreground truncate">
					{tool.name || 'Unnamed Tool'}
				</h3>
				{#if isOwner}
					<span class="text-xs text-primary dark:text-blue-400 font-medium">You</span>
				{/if}
			</div>
		</div>

		<!-- Actions (only for owners) -->
		{#if isOwner && onEdit}
			<div class="flex gap-1">
				<button
					onclick={handleEdit}
					class="p-1.5 text-muted-foreground hover:text-primary dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
					aria-label="Edit tool"
				>
					<Pencil class="w-4 h-4" />
				</button>
				<button
					onclick={handleDelete}
					class="p-1.5 text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
					aria-label="Delete tool"
				>
					<Trash class="w-4 h-4" />
				</button>
			</div>
		{/if}
	</div>

	<!-- Description -->
	<p class="text-sm text-muted-foreground mb-3 line-clamp-2">
		{tool.description || 'No description available'}
	</p>

	<!-- Command -->
	{#if tool.command}
		<div class="mb-3">
			<code class="text-xs bg-muted px-2 py-1 rounded font-mono text-foreground break-all">
				{tool.command}
			</code>
		</div>
	{/if}

	<!-- Capabilities -->
	{#if tool.capabilities.length > 0}
		<div class="flex flex-wrap gap-1">
			{#each tool.capabilities.slice(0, 3) as capability}
				<span class="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
					{capability}
				</span>
			{/each}
			{#if tool.capabilities.length > 3}
				<span class="text-xs px-2 py-1 bg-muted text-muted-foreground rounded">
					+{tool.capabilities.length - 3} more
				</span>
			{/if}
		</div>
	{/if}
</div>
