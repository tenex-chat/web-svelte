<script lang="ts">
	import type { ProjectAgent } from '$lib/events/NDKProjectStatus';
	import { ndk } from '$lib/ndk.svelte';
	import { NDKEvent } from '@nostr-dev-kit/ndk';
	import { NDKKind } from '$lib/kinds';
	import type { NDKProject } from '$lib/events/NDKProject';
	import { X } from 'lucide-svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import ToolGroupItem from './ToolGroupItem.svelte';

	interface Props {
		open?: boolean;
		project: NDKProject;
		agent: ProjectAgent;
		availableModels: string[];
		availableTools: string[];
	}
	let { open = $bindable(false), project, agent, availableModels, availableTools }: Props = $props();

	// Local state for editing - sync from agent prop when it changes
	let selectedModel = $state('');
	let selectedTools = $state<SvelteSet<string>>(new SvelteSet());

	$effect(() => {
		selectedModel = agent.model || '';
		selectedTools = new SvelteSet(agent.tools || []);
	});

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

	let expandedGroups = $state<SvelteSet<string>>(new SvelteSet());

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

	async function handleSave() {
		if (!ndk || !ndk.$currentUser) return;

		try {
			const projectTagId = project.tagId();
			if (!projectTagId) {
				console.error('[AgentConfigDialog] Project tag ID not found');
				return;
			}

			// Create a kind 24020 event to update agent configuration
			const changeEvent = new NDKEvent(ndk);
			changeEvent.kind = NDKKind.TenexAgentConfigUpdate;
			changeEvent.content = '';
			changeEvent.tags = [
				['p', agent.pubkey], // Target agent
				['model', selectedModel], // New model slug
				['a', projectTagId] // Project reference
			];

			// Add tool tags - one tag per tool
			for (const tool of Array.from(selectedTools)) {
				changeEvent.tags.push(['tool', tool]);
			}

			await changeEvent.publish();
			open = false;
		} catch (error) {
			console.error('[AgentConfigDialog] Failed to save agent config:', error);

	}
}

function handleClose() {
	open = false;
}


	// Reset state when agent changes
	$effect(() => {
		selectedModel = agent.model || '';
		selectedTools = new SvelteSet(agent.tools || []);
	});
</script>

{#if open}
	<div
		class="fixed inset-0 bg-overlay/50 flex items-center justify-center z-50 p-4"
		onclick={handleClose}
		onkeydown={(e) => {
			if (e.key === 'Escape') handleClose();
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
					onclick={handleClose}
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
						class="w-full px-3 py-2 border border-border bg-input text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
								<ToolGroupItem
									{group}
									{expandedGroups}
									{selectedTools}
									{toggleGroup}
									{toggleGroupAll}
									{toggleTool}
								/>
							{/each}
						</div>
					</div>
				</div>
			</div>

			<!-- Footer -->
			<div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted">
				<button
					type="button"
					onclick={handleClose}
					class="px-4 py-2 text-sm font-medium text-foreground hover:bg-accent rounded-lg transition-colors"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={handleSave}
					class="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg transition-colors"
				>
					Save Changes
				</button>
			</div>
		</div>
	</div>
{/if}
