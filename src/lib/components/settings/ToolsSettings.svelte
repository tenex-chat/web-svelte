<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import type { NDKProject } from '$lib/events/NDKProject';
	import { NDKMCPTool } from '$lib/events/NDKMCPTool';
	import MCPToolItem from './MCPToolItem.svelte';
	import { Plus, X, Search } from 'lucide-svelte';

	interface Props {
		project: NDKProject;
	}

	let { project }: Props = $props();

	// Get original MCP tool event IDs from project tags
	const originalToolIds = $derived.by(() => {
		return project.tags
			.filter(tag => tag[0] === 'mcp')
			.map(tag => tag[1]);
	});

	// Local state for pending changes
	let pendingToolIds = $state<string[]>([]);

	// Initialize pending state from project
	$effect(() => {
		pendingToolIds = [...originalToolIds];
	});

	// Detect if there are unsaved changes
	const hasChanges = $derived.by(() => {
		if (pendingToolIds.length !== originalToolIds.length) return true;

		for (let i = 0; i < pendingToolIds.length; i++) {
			if (pendingToolIds[i] !== originalToolIds[i]) return true;
		}

		return false;
	});

	let isSaving = $state(false);
	let showAddDialog = $state(false);
	let searchQuery = $state('');

	// Get all available MCP tool definitions
	const allToolsSubscription = ndk.$subscribe<NDKMCPTool>(() => ({
		kinds: [4200],
	}));

	const availableTools = $derived.by(() => {
		const tools = Array.from(allToolsSubscription.events || []);
		// Filter out tools that are already added
		let filtered = tools.filter(event => !pendingToolIds.includes(event.id));

		// Apply search filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(event => {
				const tool = NDKMCPTool.from(event);
				return (
					tool.name?.toLowerCase().includes(query) ||
					tool.description?.toLowerCase().includes(query) ||
					tool.command?.toLowerCase().includes(query)
				);
			});
		}

		return filtered;
	});

	function addTool(eventId: string) {
		if (!pendingToolIds.includes(eventId)) {
			pendingToolIds = [...pendingToolIds, eventId];
		}
		showAddDialog = false;
		searchQuery = '';
	}

	function closeAddDialog() {
		showAddDialog = false;
		searchQuery = '';
	}

	function removeTool(eventId: string) {
		pendingToolIds = pendingToolIds.filter(id => id !== eventId);
	}

	async function handleSave() {
		if (!ndk.$currentUser || isSaving) return;

		isSaving = true;
		try {
			// Clear existing mcp tags
			project.tags = project.tags.filter(tag => tag[0] !== 'mcp');

			// Add tools
			pendingToolIds.forEach(id => {
				project.addMCPTool(id);
			});

			await project.publishReplaceable();
		} catch (error) {
			console.error('Failed to save tools:', error);
			alert('Failed to save changes. Please try again.');
		} finally {
			isSaving = false;
		}
	}

	function handleCancel() {
		// Reset to original state
		pendingToolIds = [...originalToolIds];
	}
</script>

<div class="p-4">
	<div class="flex items-center justify-between mb-4">
		<div>
			<h2 class="text-lg font-semibold">MCP Tools</h2>
			<p class="text-sm text-muted-foreground mt-1">
				Tools assigned to this project
			</p>
		</div>
		<button
			onclick={() => (showAddDialog = true)}
			disabled={isSaving}
			class="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
		>
			<Plus class="w-4 h-4" />
			Add Tool
		</button>
	</div>

	<div class="space-y-4">
		{#if pendingToolIds.length === 0}
			<div class="text-sm text-muted-foreground p-4 border border-border rounded-lg bg-card text-center">
				No tools assigned to this project yet.
			</div>
		{:else}
			<div class="grid gap-4 md:grid-cols-2">
				{#each pendingToolIds as eventId (eventId)}
					<MCPToolItem
						eventId={eventId}
						disabled={isSaving}
						onRemove={() => removeTool(eventId)}
					/>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Save/Cancel Buttons -->
	{#if hasChanges}
		<div class="flex gap-3 mt-6 pt-4 border-t border-border">
			<button
				onclick={handleCancel}
				disabled={isSaving}
				class="px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
			>
				Cancel
			</button>
			<button
				onclick={handleSave}
				disabled={isSaving}
				class="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
			>
				{isSaving ? 'Saving...' : 'Save Changes'}
			</button>
		</div>
	{/if}
</div>

<!-- Add Tool Dialog -->
{#if showAddDialog}
	<div
		class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeAddDialog();
		}}
	>
		<div class="bg-card rounded-lg border border-border max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
			<div class="p-4 border-b border-border">
				<div class="flex items-center justify-between mb-3">
					<h3 class="text-lg font-semibold">Add Tool to Project</h3>
					<button
						onclick={closeAddDialog}
						class="p-2 hover:bg-muted rounded-md transition-colors"
					>
						<X class="w-5 h-5" />
					</button>
				</div>

				<!-- Search Input -->
				<div class="relative">
					<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Search tools by name, command, or description..."
						class="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
					/>
					{#if searchQuery}
						<button
							onclick={() => (searchQuery = '')}
							class="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
						>
							<X class="w-4 h-4 text-muted-foreground" />
						</button>
					{/if}
				</div>
			</div>

			<div class="flex-1 overflow-y-auto p-4">
				{#if availableTools.length === 0}
					<div class="text-center text-muted-foreground p-8">
						<p>No available tool definitions found.</p>
						<p class="text-sm mt-2">All tools have been added to this project.</p>
					</div>
				{:else}
					<div class="grid gap-4 md:grid-cols-2">
						{#each availableTools as toolEvent (toolEvent.id)}
							{@const tool = NDKMCPTool.from(toolEvent)}
							<button
								onclick={() => addTool(toolEvent.id)}
								class="text-left p-4 border border-border rounded-lg hover:bg-muted transition-colors"
							>
								<h4 class="font-medium text-foreground mb-1 font-mono text-sm">
									{tool.name || 'Unnamed Tool'}
								</h4>
								{#if tool.command}
									<span class="inline-block px-2 py-0.5 text-xs bg-muted text-foreground rounded mb-2 font-mono">
										{tool.command}
									</span>
								{/if}
								<p class="text-sm text-muted-foreground line-clamp-2">
									{tool.description || 'No description'}
								</p>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
