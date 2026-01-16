<script lang="ts">
	import { viewModeStore, type ViewMode } from '$lib/stores/viewMode.svelte';
	import { cn } from '$lib/utils/cn';
	import * as DropdownMenu from './ui/dropdown-menu';
	import { Columns, LayoutGrid, Network, Check } from 'lucide-svelte';

	interface Props {
		collapsed?: boolean;
	}

	let { collapsed = false }: Props = $props();

	const viewMode = $derived(viewModeStore.value);

	const viewOptions: { mode: ViewMode; label: string; icon: typeof Columns }[] = [
		{ mode: 'projects', label: 'Projects', icon: Columns },
		{ mode: 'status', label: 'Status Dashboard', icon: LayoutGrid },
		{ mode: 'graph', label: 'Delegation Graph', icon: Network }
	];

	function getCurrentIcon() {
		const option = viewOptions.find((o) => o.mode === viewMode);
		return option?.icon ?? Columns;
	}

	function handleSelect(mode: ViewMode) {
		viewModeStore.set(mode);
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger
		class={cn(
			'flex items-center justify-center rounded hover:bg-muted transition-colors',
			collapsed ? 'w-10 h-10' : 'w-8 h-8',
			viewMode !== 'projects' && 'text-primary'
		)}
		aria-label="Switch view mode"
		title="Switch view mode"
	>
		<svelte:component this={getCurrentIcon()} class="w-4 h-4" />
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="start" class="w-48">
		{#each viewOptions as option (option.mode)}
			<DropdownMenu.Item onclick={() => handleSelect(option.mode)}>
				<svelte:component this={option.icon} class="mr-2 h-4 w-4" />
				<span class={cn(viewMode === option.mode && 'font-semibold')}>{option.label}</span>
				{#if viewMode === option.mode}
					<Check class="ml-auto h-4 w-4" />
				{/if}
			</DropdownMenu.Item>
		{/each}
	</DropdownMenu.Content>
</DropdownMenu.Root>
