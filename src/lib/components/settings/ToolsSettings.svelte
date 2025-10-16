<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import type { NDKProject } from '$lib/events/NDKProject';
	import { NDKKind } from '@nostr-dev-kit/ndk';

	interface Props {
		project: NDKProject;
	}

	let { project }: Props = $props();

	const currentUser = $derived(ndk.$sessions.currentUser);

	// Subscribe to MCP tools (kind:4200)
	const toolsSubscription = ndk.$subscribe(() => ({
		filters: [
			{
				kinds: [4200],
				'#a': [project.tagId()]
			}
		],
		closeOnEose: false
	}));

	const mcpTools = $derived(toolsSubscription.events);

	let showAddTool = $state(false);
	let newToolName = $state('');
	let newToolDescription = $state('');
	let newToolSchema = $state('{}');
	let isAddingTool = $state(false);

	async function handleAddTool() {
		if (!currentUser || !newToolName.trim() || isAddingTool) return;

		isAddingTool = true;
		try {
			// Validate JSON schema
			try {
				JSON.parse(newToolSchema);
			} catch {
				alert('Invalid JSON schema');
				isAddingTool = false;
				return;
			}

			// Add tool reference to project
			project.addMCPTool(newToolName.trim());

			// Sign and publish updated project
			await project.sign();
			await project.publish();

			// Reset form
			newToolName = '';
			newToolDescription = '';
			newToolSchema = '{}';
			showAddTool = false;
		} catch (error) {
			console.error('Failed to add tool:', error);
		} finally {
			isAddingTool = false;
		}
	}

	async function handleRemoveTool(toolName: string) {
		if (!currentUser) return;

		try {
			// Remove tool from project tags
			project.tags = project.tags.filter((tag) => {
				return !(tag[0] === 'tool' && tag[1] === toolName);
			});

			// Sign and publish updated project
			await project.sign();
			await project.publish();
		} catch (error) {
			console.error('Failed to remove tool:', error);
		}
	}

	// Get current project tools from tags
	const projectTools = $derived.by(() => {
		return project.tags.filter((tag) => tag[0] === 'tool').map((tag) => tag[1]);
	});
</script>

<div class="p-4">
	<div class="flex items-center justify-between mb-4">
		<h2 class="text-lg font-semibold">MCP Tools</h2>
		<button
			onclick={() => (showAddTool = !showAddTool)}
			class="px-3 py-1.5 bg-primary hover:bg-primary/90 text-white rounded text-sm font-medium transition-colors"
		>
			{showAddTool ? 'Cancel' : 'Add Tool'}
		</button>
	</div>

	<!-- Add Tool Form -->
	{#if showAddTool}
		<div class="mb-4 p-4 border border-border rounded-lg bg-white">
			<h3 class="text-sm font-medium mb-3">Add MCP Tool</h3>
			<div class="space-y-3">
				<div>
					<label for="tool-name" class="block text-sm font-medium text-foreground mb-1">
						Tool Name
					</label>
					<input
						id="tool-name"
						type="text"
						bind:value={newToolName}
						placeholder="e.g., file_read"
						class="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<div>
					<label for="tool-description" class="block text-sm font-medium text-foreground mb-1">
						Description
					</label>
					<textarea
						id="tool-description"
						bind:value={newToolDescription}
						placeholder="What does this tool do?"
						rows="2"
						class="w-full px-3 py-2 border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
					></textarea>
				</div>

				<div>
					<label for="tool-schema" class="block text-sm font-medium text-foreground mb-1">
						JSON Schema
					</label>
					<textarea
						id="tool-schema"
						bind:value={newToolSchema}
						placeholder="{JSON.stringify({ type: 'object', properties: {} }, null, 2)}"
						rows="4"
						class="w-full px-3 py-2 border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
					></textarea>
				</div>

				<button
					onclick={handleAddTool}
					disabled={!newToolName.trim() || isAddingTool}
					class="w-full px-4 py-2 bg-primary hover:bg-primary/90 disabled:bg-secondary disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
				>
					{isAddingTool ? 'Adding...' : 'Add Tool'}
				</button>
			</div>
		</div>
	{/if}

	<!-- Current Tools List -->
	<div class="space-y-4">
		<!-- Project Tools (from tags) -->
		<div>
			<h3 class="text-sm font-medium text-foreground mb-2">Project Tools</h3>
			{#if projectTools.length === 0}
				<div class="text-sm text-muted-foreground p-4 border border-border rounded-lg bg-white text-center">
					No MCP tools configured for this project yet.
				</div>
			{:else}
				<div class="space-y-2">
					{#each projectTools as toolName (toolName)}
						<div class="p-3 border border-border rounded-lg bg-white">
							<div class="flex items-center justify-between">
								<div class="flex-1">
									<div class="font-medium text-sm font-mono">{toolName}</div>
								</div>
								<button
									onclick={() => handleRemoveTool(toolName)}
									class="ml-2 p-1 text-muted-foreground hover:text-red-600 rounded transition-colors"
									title="Remove tool"
									aria-label="Remove tool"
								>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
										/>
									</svg>
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Tool Definitions (kind:4200) -->
		{#if mcpTools.length > 0}
			<div>
				<h3 class="text-sm font-medium text-foreground mb-2">Tool Definitions (kind:4200)</h3>
				<div class="space-y-2">
					{#each mcpTools as tool (tool.id)}
						{@const name = tool.tagValue('name')}
						{@const description = tool.tagValue('description')}
						<div class="p-3 border border-border rounded-lg bg-white">
							<div class="font-medium text-sm font-mono">{name || 'Unnamed'}</div>
							{#if description}
								<div class="text-xs text-muted-foreground mt-1">{description}</div>
							{/if}
							{#if tool.content}
								<details class="mt-2">
									<summary class="text-xs text-primary cursor-pointer hover:text-blue-700">
										View Schema
									</summary>
									<pre
										class="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">{tool.content}</pre>
								</details>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Info Box -->
		<div class="p-3 bg-blue-50 border border-blue-200 rounded-lg">
			<h4 class="text-sm font-medium text-blue-900 mb-1">About MCP Tools</h4>
			<p class="text-xs text-blue-800">
				MCP (Model Context Protocol) tools allow agents to perform actions like reading files, running
				commands, or accessing APIs. Tools are defined using JSON schemas and can be shared across
				projects.
			</p>
		</div>
	</div>
</div>
