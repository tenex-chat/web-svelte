<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { NDKMCPTool } from '$lib/events/NDKMCPTool';
	import { cn } from '$lib/utils/cn';

	interface Props {
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		tool?: NDKMCPTool | null;
		onClose?: () => void;
	}

	let { open = $bindable(false), onOpenChange, tool = null, onClose }: Props = $props();

	let name = $state('');
	let description = $state('');
	let command = $state('');
	let capabilities = $state<string[]>([]);
	let newCapability = $state('');
	let saving = $state(false);

	const isEditing = $derived(tool !== null);

	// Initialize form when tool changes or dialog opens
	$effect(() => {
		if (open && tool) {
			name = tool.name || '';
			description = tool.description || '';
			command = tool.command || '';
			capabilities = [...(tool.capabilities || [])];
		} else if (open && !tool) {
			// Reset for create
			name = '';
			description = '';
			command = '';
			capabilities = [];
		}
	});

	function handleClose() {
		open = false;
		onOpenChange?.(false);
		onClose?.();
		resetForm();
	}

	function resetForm() {
		name = '';
		description = '';
		command = '';
		capabilities = [];
		newCapability = '';
	}

	function addCapability() {
		const cap = newCapability.trim();
		if (cap && !capabilities.includes(cap)) {
			capabilities = [...capabilities, cap];
			newCapability = '';
		}
	}

	function removeCapability(cap: string) {
		capabilities = capabilities.filter((c) => c !== cap);
	}

	async function handleSave() {
		if (!name.trim() || !command.trim()) {
			alert('Name and command are required');
			return;
		}

		saving = true;

		try {
			const mcpTool = tool || new NDKMCPTool(ndk);

			mcpTool.name = name.trim();
			mcpTool.description = description.trim();
			mcpTool.command = command.trim();
			mcpTool.capabilities = capabilities;

			await mcpTool.publish();

			handleClose();
		} catch (error) {
			console.error('Failed to save tool:', error);
			alert('Failed to save tool. Please try again.');
		} finally {
			saving = false;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			handleClose();
		}
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
		onclick={handleClose}
		onkeydown={handleKeydown}
		role="presentation"
		tabindex="0"
	>
		<div
			class="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-zinc-900 rounded-lg shadow-xl flex flex-col"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
		>
			<!-- Close Button -->
			<button
				onclick={handleClose}
				class="absolute top-4 right-4 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 z-10"
				aria-label="Close dialog"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					/>
				</svg>
			</button>

			<!-- Header -->
			<div class="px-6 pt-6 pb-4">
				<h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
					<svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
					{isEditing ? 'Edit MCP Tool' : 'Create MCP Tool'}
				</h2>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
					{isEditing ? 'Update your MCP tool details' : 'Add a new Model Context Protocol tool'}
				</p>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto px-6 py-4 space-y-4">
				<!-- Name -->
				<div>
					<label for="tool-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Name <span class="text-red-500">*</span>
					</label>
					<input
						id="tool-name"
						type="text"
						bind:value={name}
						class="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-950 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
						placeholder="My MCP Tool"
					/>
				</div>

				<!-- Description -->
				<div>
					<label for="tool-description" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Description
					</label>
					<textarea
						id="tool-description"
						bind:value={description}
						rows="3"
						class="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-950 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
						placeholder="Describe what this tool does..."
					></textarea>
				</div>

				<!-- Command -->
				<div>
					<label for="tool-command" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Command <span class="text-red-500">*</span>
					</label>
					<input
						id="tool-command"
						type="text"
						bind:value={command}
						class="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-950 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
						placeholder="mcp-server-tool"
					/>
					<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
						The command to execute this MCP tool (e.g., mcp-server-filesystem)
					</p>
				</div>

				<!-- Capabilities -->
				<div>
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Capabilities</label>
					<div class="flex gap-2 mb-2">
						<input
							type="text"
							bind:value={newCapability}
							onkeydown={(e) => e.key === 'Enter' && addCapability()}
							class="flex-1 px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-950 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="Add capability (e.g., read_files)"
						/>
						<button
							type="button"
							onclick={addCapability}
							disabled={!newCapability.trim()}
							class={cn(
								'px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-300 transition-colors',
								!newCapability.trim() && 'opacity-50 cursor-not-allowed'
							)}
						>
							Add
						</button>
					</div>
					{#if capabilities.length > 0}
						<div class="flex flex-wrap gap-2">
							{#each capabilities as cap}
								<span
									class="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-sm"
								>
									{cap}
									<button
										type="button"
										onclick={() => removeCapability(cap)}
										class="hover:text-blue-900 dark:hover:text-blue-100"
										aria-label="Remove capability"
									>
										×
									</button>
								</span>
							{/each}
						</div>
					{:else}
						<p class="text-sm text-gray-500 dark:text-gray-400">No capabilities added</p>
					{/if}
				</div>
			</div>

			<!-- Footer -->
			<div class="px-6 py-4 border-t border-gray-200 dark:border-zinc-700 flex justify-end gap-2">
				<button
					onclick={handleClose}
					class="px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-300 transition-colors"
				>
					Cancel
				</button>
				<button
					onclick={handleSave}
					disabled={!name.trim() || !command.trim() || saving}
					class={cn(
						'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2',
						(!name.trim() || !command.trim() || saving) && 'opacity-50 cursor-not-allowed'
					)}
				>
					{#if saving}
						<svg
							class="w-4 h-4 animate-spin"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
							/>
						</svg>
						Saving...
					{:else}
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M5 13l4 4L19 7"
							/>
						</svg>
						{isEditing ? 'Update Tool' : 'Create Tool'}
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
