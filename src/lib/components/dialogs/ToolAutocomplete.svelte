<script lang="ts">
	import Portal from 'svelte-portal';

	interface Props {
		inputValue: string;
		availableTools: string[];
		excludeTools: string[];
		onSelectTool: (tool: string) => void;
		onKeyDown?: (e: KeyboardEvent) => boolean;
		inputElement?: HTMLInputElement | null;
	}

	let {
		inputValue,
		availableTools,
		excludeTools,
		onSelectTool,
		onKeyDown = $bindable(() => false),
		inputElement = null
	}: Props = $props();

	let showAutocomplete = $state(false);
	let selectedIndex = $state(0);
	let isFocused = $state(false);
	let dropdownPosition = $state({ top: 0, left: 0, width: 0 });

	const filteredTools = $derived.by(() => {
		if (!isFocused) return [];

		const query = inputValue.toLowerCase().trim();
		const filtered = availableTools
			.filter((tool) => !tool.startsWith('mcp__'))
			.filter((tool) => !excludeTools.includes(tool))
			.filter((tool) => tool.toLowerCase().includes(query))
			.sort((a, b) => a.localeCompare(b));

		return filtered;
	});

	const isActive = $derived(showAutocomplete && filteredTools.length > 0);

	function handleKeyDownInternal(e: KeyboardEvent): boolean {
		if (!isActive) return false;

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			selectedIndex = (selectedIndex + 1) % filteredTools.length;
			return true;
		}
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			selectedIndex = selectedIndex === 0 ? filteredTools.length - 1 : selectedIndex - 1;
			return true;
		}
		if (e.key === 'Enter' || e.key === 'Tab') {
			e.preventDefault();
			selectTool(filteredTools[selectedIndex]);
			return true;
		}
		if (e.key === 'Escape') {
			e.preventDefault();
			showAutocomplete = false;
			isFocused = false;
			return true;
		}

		return false;
	}

	function selectTool(tool: string) {
		onSelectTool(tool);
		showAutocomplete = false;
		selectedIndex = 0;
	}

	export function show() {
		if (inputElement) {
			const rect = inputElement.getBoundingClientRect();
			dropdownPosition = {
				top: rect.top - 8,
				left: rect.left,
				width: rect.width
			};
		}
		isFocused = true;
		showAutocomplete = true;
		selectedIndex = 0;
	}

	export function hide() {
		isFocused = false;
		showAutocomplete = false;
	}

	onKeyDown = handleKeyDownInternal;
</script>

{#if isActive}
	<Portal>
		<div
			class="fixed bg-popover/90 backdrop-blur-xl border border-border/50 rounded-xl shadow-lg overflow-hidden"
			style="top: {dropdownPosition.top}px; left: {dropdownPosition.left}px; width: {dropdownPosition.width}px; z-index: 9999; transform: translateY(-100%);"
		>
			<div class="max-h-64 overflow-y-auto">
				{#each filteredTools as tool, index (tool)}
					<button
						type="button"
						onclick={() => selectTool(tool)}
						onmouseenter={() => (selectedIndex = index)}
						class="w-full px-3 py-2 text-left hover:bg-blue-50/50 transition-colors {index ===
						selectedIndex
							? 'bg-blue-100/50'
							: ''}"
					>
						<div class="font-medium text-sm text-foreground">{tool}</div>
					</button>
				{/each}
			</div>
			<div
				class="px-3 py-1 bg-muted/50 backdrop-blur-sm border-t border-border/50 text-xs text-muted-foreground"
			>
				↑↓ navigate • ↵ select • esc dismiss
			</div>
		</div>
	</Portal>
{/if}
