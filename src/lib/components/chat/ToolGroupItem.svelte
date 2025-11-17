<script lang="ts">
	import { ChevronDown, ChevronRight } from 'lucide-svelte';
	import type { SvelteSet } from 'svelte/reactivity';

	interface ToolGroup {
		name: string;
		tools: string[];
		expanded: boolean;
	}

	interface Props {
		group: ToolGroup;
		expandedGroups: SvelteSet<string>;
		selectedTools: SvelteSet<string>;
		toggleGroup: (groupName: string) => void;
		toggleGroupAll: (group: ToolGroup, enable: boolean) => void;
		toggleTool: (tool: string) => void;
	}

	const { group, expandedGroups, selectedTools, toggleGroup, toggleGroupAll, toggleTool }: Props = $props();

	const isExpanded = $derived(expandedGroups.has(group.name));
	const isFullySelected = $derived(group.tools.every((tool) => selectedTools.has(tool)));
	const isPartiallySelected = $derived.by(() => {
		const selected = group.tools.filter((tool) => selectedTools.has(tool)).length;
		return selected > 0 && selected < group.tools.length;
	});
	const isMultiTool = $derived(group.tools.length > 1);
</script>

<div class="border-b border-border last:border-b-0">
	<!-- Group Header -->
	<div class="flex items-center gap-2 px-4 py-2 hover:bg-accent transition-colors">
		<!-- Expand/Collapse button (only for multi-tool groups) -->
		{#if isMultiTool}
			<button
				type="button"
				onclick={() => toggleGroup(group.name)}
				class="p-1 hover:bg-accent rounded transition-colors"
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
			onchange={(e) => toggleGroupAll(group, (e.target as HTMLInputElement).checked)}
			class="w-4 h-4 text-primary rounded border-border focus:ring-blue-500 bg-input"
		/>

		<!-- Group Name -->
		<div class="flex-1">
			<div class="font-medium text-sm text-foreground">{group.name}</div>
			{#if isMultiTool}
				<div class="text-xs text-muted-foreground">
					{group.tools.filter((t) => selectedTools.has(t)).length}/{group.tools.length} selected
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
		<div class="bg-muted px-4 py-2 space-y-1">
			{#each group.tools as tool (tool)}
				<label class="flex items-center gap-2 p-2 hover:bg-accent rounded cursor-pointer">
					<input
						type="checkbox"
						checked={selectedTools.has(tool)}
						onchange={() => toggleTool(tool)}
						class="w-4 h-4 text-primary rounded border-border focus:ring-blue-500 bg-input"
					/>
					<span class="text-sm font-mono text-foreground">{tool}</span>
				</label>
			{/each}
		</div>
	{/if}
</div>
