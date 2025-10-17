<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ndk } from '$lib/ndk.svelte';
	import { NDKMCPTool } from '$lib/events/NDKMCPTool';
	import CreateMCPToolDialog from '$lib/components/dialogs/CreateMCPToolDialog.svelte';

	const toolId = $derived($page.params.id);

	const toolEventSub = ndk.$subscribe(
		() => (toolId ? { ids: [toolId], kinds: [NDKMCPTool.kind] } : undefined),
		{ closeOnEose: true }
	);

	const tool = $derived(() => {
		const event = toolEventSub?.events?.[0];
		return event ? NDKMCPTool.from(event) : null;
	});

	const isOwner = $derived(tool()?.pubkey === ndk.$currentUser?.pubkey);

	let showEditDialog = $state(false);
	let showActionsDropdown = $state(false);

	function handleBack() {
		goto('/tools');
	}

	async function handleCopyId() {
		if (tool()) {
			await navigator.clipboard.writeText(tool()!.id);
			alert('Tool ID copied to clipboard');
		}
	}

	function handleEdit() {
		showEditDialog = true;
		showActionsDropdown = false;
	}

	async function handleDelete() {
		if (!tool() || !confirm(`Are you sure you want to delete "${tool()!.name}"?`)) {
			return;
		}

		try {
			const deleteEvent = await tool()!.delete();
			if (deleteEvent) {
				await deleteEvent.publish();
			}
			goto('/tools');
		} catch (error) {
			console.error('Failed to delete tool:', error);
			alert('Failed to delete tool. Please try again.');
		}
	}

	function getToolIcon(command?: string): string {
		if (!command) return '🛠️';
		if (command.includes('mcp')) return '⚙️';
		if (command.includes('code')) return '💻';
		return '🛠️';
	}
</script>

<div class="container mx-auto px-4 py-6 max-w-4xl">
	{#if !tool()}
		<div class="text-center py-16">
			<div class="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
			<p class="text-muted-foreground">Loading tool...</p>
		</div>
	{:else}
		<!-- Header -->
		<div class="mb-6 flex items-start justify-between">
			<div class="flex items-start gap-4">
				<button
					onclick={handleBack}
					class="p-2 hover:bg-muted rounded-lg transition-colors"
					aria-label="Back to tools"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M10 19l-7-7m0 0l7-7m-7 7h18"
						/>
					</svg>
				</button>
				<div>
					<div class="flex items-center gap-3 mb-2">
						<span class="text-3xl">{getToolIcon(tool()?.command)}</span>
						<div>
							<h1 class="text-2xl font-bold text-foreground">
								{tool()?.name || 'Unnamed Tool'}
							</h1>
							{#if isOwner}
								<span class="text-sm text-primary font-medium">Your Tool</span>
							{/if}
						</div>
					</div>
					<p class="text-muted-foreground">{tool()?.description || 'No description available'}</p>
				</div>
			</div>

			<!-- Actions -->
			{#if isOwner}
				<div class="relative">
					<button
						onclick={() => (showActionsDropdown = !showActionsDropdown)}
						class="px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors flex items-center gap-2"
					>
						Actions
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 9l-7 7-7-7"
							/>
						</svg>
					</button>

					{#if showActionsDropdown}
						<div
							class="absolute right-0 mt-2 w-48 bg-popover border border-border rounded-lg shadow-lg z-10"
						>
							<button
								onclick={handleEdit}
								class="w-full px-4 py-2 text-left hover:bg-muted flex items-center gap-2 rounded-t-lg"
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
									/>
								</svg>
								Edit Tool
							</button>
							<button
								onclick={handleDelete}
								class="w-full px-4 py-2 text-left hover:bg-muted flex items-center gap-2 text-red-600 rounded-b-lg"
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
									/>
								</svg>
								Delete Tool
							</button>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Content -->
		<div class="bg-card border border-border rounded-lg p-6 space-y-6">
			<!-- Command -->
			{#if tool()?.command}
				<div>
					<h3 class="text-sm font-medium text-foreground mb-2">Command</h3>
					<code class="block p-3 bg-muted rounded-lg text-sm font-mono text-foreground">
						{tool()?.command}
					</code>
				</div>
			{/if}

			<!-- Capabilities -->
			{#if tool()?.capabilities.length}
				<div>
					<h3 class="text-sm font-medium text-foreground mb-2">
						Capabilities ({tool()?.capabilities.length})
					</h3>
					<div class="flex flex-wrap gap-2">
						{#each tool()!.capabilities as capability}
							<span class="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm">
								{capability}
							</span>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Tool ID -->
			<div>
				<h3 class="text-sm font-medium text-foreground mb-2">Tool ID</h3>
				<div class="flex items-center gap-2">
					<code class="flex-1 p-3 bg-muted rounded-lg text-xs font-mono text-foreground truncate">
						{tool()?.id}
					</code>
					<button
						onclick={handleCopyId}
						class="px-3 py-2 border border-border rounded-lg hover:bg-muted transition-colors flex items-center gap-2"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
							/>
						</svg>
						Copy
					</button>
				</div>
			</div>

			<!-- Metadata -->
			<div class="pt-4 border-t border-border">
				<div class="grid grid-cols-2 gap-4 text-sm">
					<div>
						<span class="text-muted-foreground">Created:</span>
						<span class="ml-2 text-foreground">
							{new Date((tool()?.created_at || 0) * 1000).toLocaleDateString()}
						</span>
					</div>
					<div>
						<span class="text-muted-foreground">Author:</span>
						<span class="ml-2 text-foreground font-mono text-xs">
							{tool()?.pubkey.substring(0, 8)}...
						</span>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Edit Dialog -->
{#if tool()}
	<CreateMCPToolDialog bind:open={showEditDialog} tool={tool()} />
{/if}
