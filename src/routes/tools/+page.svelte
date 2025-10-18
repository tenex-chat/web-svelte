<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { NDKMCPTool } from '$lib/events/NDKMCPTool';
	import MCPToolCard from '$lib/components/mcp/MCPToolCard.svelte';
	import CreateMCPToolDialog from '$lib/components/dialogs/CreateMCPToolDialog.svelte';
	import { Plus, Settings } from 'lucide-svelte';

	let searchQuery = $state('');
	let filterMode = $state<'all' | 'mine'>('all');
	let showCreateDialog = $state(false);
	let editingTool = $state<NDKMCPTool | null>(null);

	const toolSubscription = ndk.$subscribe({ kinds: [NDKMCPTool.kind] });
	const allTools = $derived(
		toolSubscription?.events?.map((event) => NDKMCPTool.from(event)) || []
	);

	const filteredTools = $derived.by(() => {
		let tools = allTools;

		// Filter by ownership
		if (filterMode === 'mine') {
			tools = tools.filter((tool) => tool.pubkey === ndk.$currentUser?.pubkey);
		}

		// Filter by search query
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			tools = tools.filter(
				(tool) =>
					tool.name?.toLowerCase().includes(query) ||
					tool.description?.toLowerCase().includes(query) ||
					tool.command?.toLowerCase().includes(query) ||
					tool.capabilities.some((cap) => cap.toLowerCase().includes(query))
			);
		}

		// Sort by creation date (newest first)
		return tools.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
	});

	function handleCreateNew() {
		editingTool = null;
		showCreateDialog = true;
	}

	function handleEdit(tool: NDKMCPTool) {
		editingTool = tool;
		showCreateDialog = true;
	}

	function handleCloseDialog() {
		showCreateDialog = false;
		editingTool = null;
	}

	const myToolsCount = $derived(
		allTools.filter((tool) => tool.pubkey === ndk.$currentUser?.pubkey).length
	);
</script>

<div class="container mx-auto px-4 py-6 max-w-7xl">
	<!-- Header -->
	<div class="mb-6">
		<h1 class="text-3xl font-bold text-foreground mb-2">MCP Tools</h1>
		<p class="text-muted-foreground">Manage Model Context Protocol tools for your projects</p>
	</div>

	<!-- Toolbar -->
	<div class="flex flex-col sm:flex-row gap-4 mb-6">
		<!-- Search -->
		<div class="flex-1">
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search tools by name, command, or capability..."
				class="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
			/>
		</div>

		<!-- Filter Tabs -->
		<div class="flex gap-2">
			<button
				onclick={() => (filterMode = 'all')}
				class={`px-4 py-2 rounded-lg transition-colors ${
					filterMode === 'all'
						? 'bg-primary text-white'
						: 'bg-muted dark:bg-zinc-900 text-foreground hover:bg-secondary dark:hover:bg-zinc-800'
				}`}
			>
				All Tools ({allTools.length})
			</button>
			<button
				onclick={() => (filterMode = 'mine')}
				class={`px-4 py-2 rounded-lg transition-colors ${
					filterMode === 'mine'
						? 'bg-primary text-white'
						: 'bg-muted dark:bg-zinc-900 text-foreground hover:bg-secondary dark:hover:bg-zinc-800'
				}`}
			>
				My Tools ({myToolsCount})
			</button>
		</div>

		<!-- Create Button -->
		{#if ndk.$currentUser}
			<button
				onclick={handleCreateNew}
				class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
			>
				<Plus class="w-5 h-5" />
				New Tool
			</button>
		{/if}
	</div>

	<!-- Tools Grid -->
	{#if filteredTools.length === 0}
		<div class="text-center py-16 bg-card rounded-lg border border-border">
			<Settings class="w-16 h-16 mx-auto text-muted-foreground mb-4" />
			<h3 class="text-lg font-medium text-foreground mb-2">No tools found</h3>
			<p class="text-muted-foreground mb-4">
				{#if searchQuery}
					Try adjusting your search criteria
				{:else if filterMode === 'mine' && !ndk.$currentUser}
					Please log in to see your tools
				{:else if filterMode === 'mine'}
					You haven't created any tools yet
				{:else}
					No MCP tools have been published yet
				{/if}
			</p>
			{#if ndk.$currentUser && filterMode === 'mine'}
				<button
					onclick={handleCreateNew}
					class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
				>
					Create Your First Tool
				</button>
			{/if}
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each filteredTools as tool (tool.id)}
				<MCPToolCard {tool} onEdit={handleEdit} />
			{/each}
		</div>
	{/if}
</div>

<!-- Create/Edit Dialog -->
<CreateMCPToolDialog
	bind:open={showCreateDialog}
	tool={editingTool}
	onClose={handleCloseDialog}
/>
