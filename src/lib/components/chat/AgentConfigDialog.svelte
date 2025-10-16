<script lang="ts">
	import type { ProjectAgent } from '$lib/events/NDKProjectStatus';
	import { ChevronDown, ChevronRight, X } from 'lucide-svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';

	interface Props {
		open: boolean;
		agent: ProjectAgent;
		availableModels: string[];
		availableTools: string[];
		onClose: () => void;
		onSave: (config: { model: string; tools: string[] }) => void;
	}

	let { open = $bindable(), agent, availableModels, availableTools, onClose, onSave }: Props = $props();

	// Local state for editing
	let selectedModel = $state(agent.model || '');
	let selectedTools: SvelteSet<string> = new SvelteSet(agent.tools || []);

	// Group tools intelligently
	interface ToolGroup {
		name: string;
		tools: string[];
		expanded: boolean;
	}

	const toolGroups = $derived.by(() => {
		const groups: SvelteMap<string, string[]> = new SvelteMap();
		const ungrouped: string[] = [];

		const allTools = availableTools || [];

		for (const tool of allTools) {
			// MCP tools: mcp__<server>__<method>
			if (tool.startsWith('mcp__')) {
				const parts = tool.split('__');
				if (parts.length >= 3) {
					const serverName = parts[1];
					const groupKey = `MCP: ${serverName}`;
					if (!groups.has(groupKey)) {
						groups.set(groupKey, []);
					}
					groups.get(groupKey)!.push(tool);
					continue;
				}
			}

			// Find common prefixes
			const prefixMatch = tool.match(/^([a-z_]+?)_/);
			if (prefixMatch) {
				const prefix = prefixMatch[1];
				// Only group if there are at least 2 tools with this prefix
				const similarTools = allTools.filter((t) => t.startsWith(prefix + '_'));
				if (similarTools.length >= 2) {
					const groupKey = prefix.toUpperCase();
					if (!groups.has(groupKey)) {
						groups.set(groupKey, []);
					}
					if (!groups.get(groupKey)!.includes(tool)) {
						groups.get(groupKey)!.push(tool);
					}
					continue;
				}
			}

			// If no group found, add to ungrouped
			ungrouped.push(tool);
		}

		// Convert to array of ToolGroup objects
		const result: ToolGroup[] = [];

		// Add grouped tools
		for (const [name, tools] of groups.entries()) {
			result.push({
				name,
				tools: tools.sort(),
				expanded: false
			});
		}

		// Add ungrouped tools as individual groups
		for (const tool of ungrouped.sort()) {
			result.push({
				name: tool,
				tools: [tool],
				expanded: false
			});
		}

		return result.sort((a, b) => a.name.localeCompare(b.name));
	});

	let expandedGroups: SvelteSet<string> = new SvelteSet();

	function toggleGroup(groupName: string) {
		if (expandedGroups.has(groupName)) {
			expandedGroups.delete(groupName);
		} else {
			expandedGroups.add(groupName);
		}
		expandedGroups = new SvelteSet(expandedGroups);
	}

	function toggleGroupAll(group: ToolGroup, enable: boolean) {
		for (const tool of group.tools) {
			if (enable) {
				selectedTools.add(tool);
			} else {
				selectedTools.delete(tool);
			}
		}
		selectedTools = new SvelteSet(selectedTools);
	}

	function toggleTool(tool: string) {
		if (selectedTools.has(tool)) {
			selectedTools.delete(tool);
		} else {
			selectedTools.add(tool);
		}
		selectedTools = new SvelteSet(selectedTools);
	}

	function isGroupFullySelected(group: ToolGroup): boolean {
		return group.tools.every((tool) => selectedTools.has(tool));
	}

	function isGroupPartiallySelected(group: ToolGroup): boolean {
		const selected = group.tools.filter((tool) => selectedTools.has(tool)).length;
		return selected > 0 && selected < group.tools.length;
	}

	function handleSave() {
		onSave({
			model: selectedModel,
			tools: Array.from(selectedTools)
		});
		onClose();
	}

	// Reset state when agent changes
	$effect(() => {
		selectedModel = agent.model || '';
		selectedTools = new SvelteSet(agent.tools || []);
	});
</script>

{#if open}
	<div
		class="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4"
		onclick={onClose}
		onkeydown={(e) => {
			if (e.key === 'Escape') onClose();
		}}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<div
			class="bg-card rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col"
			onclick={(e) => e.stopPropagation()}
			role="document"
		>
			<!-- Header -->
			<div class="flex items-center justify-between px-6 py-4 border-b border-border">
				<div>
					<h2 class="text-lg font-semibold text-foreground">Configure Agent</h2>
					<p class="text-sm text-muted-foreground">{agent.name}</p>
				</div>
				<button
					type="button"
					onclick={onClose}
					class="p-2 rounded-lg hover:bg-muted transition-colors"
					aria-label="Close"
				>
					<X class="w-5 h-5 text-foreground" />
				</button>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto px-6 py-4 space-y-6">
				<!-- Model Selection -->
				<div>
					<label class="block text-sm font-medium text-foreground mb-2">LLM Model</label>
					<select
						bind:value={selectedModel}
						class="w-full px-3 py-2 border border-border bg-white dark:bg-zinc-800 text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
					>
						<option value="">Select a model...</option>
						{#each availableModels as model}
							<option value={model}>{model}</option>
						{/each}
					</select>
				</div>

				<!-- Tools Selection -->
				<div>
					<label class="block text-sm font-medium text-foreground mb-2">Available Tools</label>
					<div class="border border-border rounded-lg overflow-hidden">
						<div class="max-h-96 overflow-y-auto">
							{#each toolGroups as group (group.name)}
								{@const isExpanded = expandedGroups.has(group.name)}
								{@const isFullySelected = isGroupFullySelected(group)}
								{@const isPartiallySelected = isGroupPartiallySelected(group)}
								{@const isMultiTool = group.tools.length > 1}

								<div class="border-b border-border last:border-b-0">
									<!-- Group Header -->
									<div
										class="flex items-center gap-2 px-4 py-2 hover:bg-muted dark:hover:bg-zinc-800 transition-colors"
									>
										<!-- Expand/Collapse button (only for multi-tool groups) -->
										{#if isMultiTool}
											<button
												type="button"
												onclick={() => toggleGroup(group.name)}
												class="p-1 hover:bg-secondary dark:hover:bg-zinc-700 rounded transition-colors"
												aria-label="Toggle group"
											>
												{#if isExpanded}
													<ChevronDown class="w-4 h-4 text-muted-foreground" />
												{:else}
													<ChevronRight class="w-4 h-4 text-muted-foreground" />
												{/if}
											</button>
										{:else}
											<div class="w-6"></div>
										{/if}

										<!-- Checkbox -->
										<input
											type="checkbox"
											checked={isFullySelected}
											indeterminate={isPartiallySelected}
											onchange={(e) =>
												toggleGroupAll(group, (e.target as HTMLInputElement).checked)}
											class="w-4 h-4 text-primary dark:text-blue-500 rounded border-border focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-zinc-800"
										/>

										<!-- Group Name -->
										<div class="flex-1">
											<div class="font-medium text-sm text-foreground">{group.name}</div>
											{#if isMultiTool}
												<div class="text-xs text-muted-foreground">
													{group.tools.filter((t) => selectedTools.has(t)).length}/{group.tools
														.length} selected
												</div>
											{/if}
										</div>

										<!-- Tool count badge -->
										{#if isMultiTool}
											<span
												class="px-2 py-0.5 bg-muted text-muted-foreground text-xs font-medium rounded-full"
											>
												{group.tools.length}
											</span>
										{/if}
									</div>

									<!-- Expanded tools list -->
									{#if isMultiTool && isExpanded}
										<div class="bg-muted dark:bg-zinc-800/50 px-4 py-2 space-y-1">
											{#each group.tools as tool (tool)}
												<label class="flex items-center gap-2 p-2 hover:bg-muted dark:hover:bg-zinc-700 rounded cursor-pointer">
													<input
														type="checkbox"
														checked={selectedTools.has(tool)}
														onchange={() => toggleTool(tool)}
														class="w-4 h-4 text-primary dark:text-blue-500 rounded border-border focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-zinc-800"
													/>
													<span class="text-sm font-mono text-foreground">{tool}</span>
												</label>
											{/each}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				</div>
			</div>

			<!-- Footer -->
			<div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted dark:bg-zinc-800">
				<button
					type="button"
					onclick={onClose}
					class="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted dark:hover:bg-zinc-700 rounded-lg transition-colors"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={handleSave}
					class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 dark:bg-blue-500 dark:hover:bg-primary rounded-lg transition-colors"
				>
					Save Changes
				</button>
			</div>
		</div>
	</div>
{/if}
