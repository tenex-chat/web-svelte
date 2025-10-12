<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { NDKMCPTool } from '$lib/events/NDKMCPTool';
	import MCPToolCard from '$lib/components/mcp/MCPToolCard.svelte';
	import CreateMCPToolDialog from '$lib/components/dialogs/CreateMCPToolDialog.svelte';

	let searchQuery = $state('');
	let filterMode = $state<'all' | 'mine'>('all');
	let showCreateDialog = $state(false);
	let editingTool = $state<NDKMCPTool | null>(null);

	const currentUser = $derived(ndk.$sessions.currentUser);
	const toolSubscription = ndk.$subscribe({ kinds: [NDKMCPTool.kind] });
	const allTools = $derived(
		toolSubscription?.events?.map((event) => NDKMCPTool.from(event)) || []
	);

	const filteredTools = $derived(() => {
		let tools = allTools;

		// Filter by ownership
		if (filterMode === 'mine') {
			tools = tools.filter((tool) => tool.pubkey === currentUser?.pubkey);
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
		allTools.filter((tool) => tool.pubkey === currentUser?.pubkey).length
	);
</script>

<div class="container mx-auto px-4 py-6 max-w-7xl">
	<!-- Header -->
	<div class="mb-6">
		<h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">MCP Tools</h1>
		<p class="text-gray-600 dark:text-gray-400">Manage Model Context Protocol tools for your projects</p>
	</div>

	<!-- Toolbar -->
	<div class="flex flex-col sm:flex-row gap-4 mb-6">
		<!-- Search -->
		<div class="flex-1">
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search tools by name, command, or capability..."
				class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
			/>
		</div>

		<!-- Filter Tabs -->
		<div class="flex gap-2">
			<button
				onclick={() => (filterMode = 'all')}
				class={`px-4 py-2 rounded-lg transition-colors ${
					filterMode === 'all'
						? 'bg-blue-600 text-white'
						: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
				}`}
			>
				All Tools ({allTools.length})
			</button>
			<button
				onclick={() => (filterMode = 'mine')}
				class={`px-4 py-2 rounded-lg transition-colors ${
					filterMode === 'mine'
						? 'bg-blue-600 text-white'
						: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
				}`}
			>
				My Tools ({myToolsCount})
			</button>
		</div>

		<!-- Create Button -->
		{#if currentUser}
			<button
				onclick={handleCreateNew}
				class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 4v16m8-8H4"
					/>
				</svg>
				New Tool
			</button>
		{/if}
	</div>

	<!-- Tools Grid -->
	{#if filteredTools().length === 0}
		<div class="text-center py-16 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
			<svg
				class="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500 mb-4"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
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
			<h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No tools found</h3>
			<p class="text-gray-600 dark:text-gray-400 mb-4">
				{#if searchQuery}
					Try adjusting your search criteria
				{:else if filterMode === 'mine' && !currentUser}
					Please log in to see your tools
				{:else if filterMode === 'mine'}
					You haven't created any tools yet
				{:else}
					No MCP tools have been published yet
				{/if}
			</p>
			{#if currentUser && filterMode === 'mine'}
				<button
					onclick={handleCreateNew}
					class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
				>
					Create Your First Tool
				</button>
			{/if}
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each filteredTools() as tool (tool.id)}
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
