<script lang="ts">
	import { goto } from '$app/navigation';

	interface Props {
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
	}

	let { open = $bindable(false), onOpenChange }: Props = $props();

	let query = $state('');
	let searchResults = $state<{ type: string; title: string; href: string }[]>([]);
	let selectedIndex = $state(0);

	function handleClose() {
		open = false;
		onOpenChange?.(false);
		query = '';
		searchResults = [];
		selectedIndex = 0;
	}

	function handleSearch() {
		// Simple search implementation - in production, this would search through:
		// - Projects
		// - Conversations
		// - Agents
		// - Settings
		searchResults = [];

		if (!query.trim()) return;

		const lowerQuery = query.toLowerCase();

		// Mock search results
		const allItems = [
			{ type: 'Page', title: 'Projects', href: '/projects' },
			{ type: 'Page', title: 'Agents', href: '/agents' },
			{ type: 'Page', title: 'MCP Tools', href: '/mcp-tools' },
			{ type: 'Page', title: 'Settings', href: '/settings' },
			{ type: 'Page', title: 'Inbox', href: '/inbox' }
		];

		searchResults = allItems.filter((item) => item.title.toLowerCase().includes(lowerQuery));
	}

	function handleSelect(href: string) {
		goto(href);
		handleClose();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			handleClose();
		} else if (event.key === 'ArrowDown') {
			event.preventDefault();
			selectedIndex = Math.min(selectedIndex + 1, searchResults.length - 1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			selectedIndex = Math.max(selectedIndex - 1, 0);
		} else if (event.key === 'Enter' && searchResults[selectedIndex]) {
			event.preventDefault();
			handleSelect(searchResults[selectedIndex].href);
		}
	}

	$effect(() => {
		handleSearch();
	});
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/50"
		onclick={handleClose}
		role="presentation"
		tabindex="0"
	>
		<div
			class="relative w-full max-w-2xl bg-white rounded-lg shadow-xl overflow-hidden"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
		>
			<!-- Search Input -->
			<div class="border-b border-gray-200 p-4">
				<div class="flex items-center gap-3">
					<svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
						/>
					</svg>
					<input
						type="text"
						bind:value={query}
						onkeydown={handleKeydown}
						placeholder="Search projects, agents, settings..."
						class="flex-1 text-lg outline-none"
						autofocus
					/>
					<kbd
						class="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100 border border-gray-200 rounded"
					>
						ESC
					</kbd>
				</div>
			</div>

			<!-- Results -->
			{#if searchResults.length > 0}
				<div class="max-h-[400px] overflow-y-auto">
					{#each searchResults as result, index (result.href)}
						<button
							onclick={() => handleSelect(result.href)}
							class="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 {selectedIndex ===
							index
								? 'bg-blue-50'
								: ''}"
						>
							<div class="flex items-center gap-3">
								<span class="text-xs font-medium text-gray-500 w-16">{result.type}</span>
								<span class="text-sm font-medium text-gray-900">{result.title}</span>
							</div>
						</button>
					{/each}
				</div>
			{:else if query.trim()}
				<div class="p-8 text-center text-gray-500">
					<p>No results found for "{query}"</p>
				</div>
			{:else}
				<div class="p-8 text-center text-gray-500">
					<p>Start typing to search...</p>
				</div>
			{/if}

			<!-- Footer -->
			<div class="border-t border-gray-200 px-4 py-3 bg-gray-50 flex items-center gap-4 text-xs text-gray-500">
				<div class="flex items-center gap-1">
					<kbd class="px-1.5 py-0.5 bg-white border border-gray-200 rounded">↑</kbd>
					<kbd class="px-1.5 py-0.5 bg-white border border-gray-200 rounded">↓</kbd>
					<span>Navigate</span>
				</div>
				<div class="flex items-center gap-1">
					<kbd class="px-1.5 py-0.5 bg-white border border-gray-200 rounded">Enter</kbd>
					<span>Select</span>
				</div>
			</div>
		</div>
	</div>
{/if}
