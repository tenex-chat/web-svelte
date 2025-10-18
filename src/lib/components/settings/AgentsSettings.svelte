<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import type { NDKProject } from '$lib/events/NDKProject';
	import { NDKAgentDefinition } from '$lib/events/NDKAgentDefinition';
	import AgentDefinitionItem from './AgentDefinitionItem.svelte';
	import AgentDefinitionCard from '$lib/components/agents/AgentDefinitionCard.svelte';
	import { Plus, X, Search } from 'lucide-svelte';

	interface Props {
		project: NDKProject;
	}

	let { project }: Props = $props();

	// Get original agent event IDs from project tags
	const originalAgentIds = $derived.by(() => {
		return project.tags
			.filter(tag => tag[0] === 'agent')
			.map(tag => tag[1]);
	});

	// Local state for pending changes
	let pendingAgentIds = $state<string[]>([]);
	let pendingPmId = $state<string | null>(null);

	// Initialize pending state from project
	$effect(() => {
		pendingAgentIds = [...originalAgentIds];
		pendingPmId = originalAgentIds.length > 0 ? originalAgentIds[0] : null;
	});

	// Detect if there are unsaved changes
	const hasChanges = $derived.by(() => {
		if (pendingAgentIds.length !== originalAgentIds.length) return true;
		if (pendingPmId !== (originalAgentIds.length > 0 ? originalAgentIds[0] : null)) return true;

		for (let i = 0; i < pendingAgentIds.length; i++) {
			if (pendingAgentIds[i] !== originalAgentIds[i]) return true;
		}

		return false;
	});

	let isSaving = $state(false);
	let showAddDialog = $state(false);
	let searchQuery = $state('');

	// Get all available agent definitions
	const allAgentsSubscription = ndk.$subscribe<NDKAgentDefinition>(() => ({
		kinds: [4199],
	}));

	const availableAgents = $derived.by(() => {
		const agents = Array.from(allAgentsSubscription.events || []);
		// Filter out agents that are already added
		let filtered = agents.filter(event => !pendingAgentIds.includes(event.id));

		// Apply search filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(event => {
				const agent = NDKAgentDefinition.from(event);
				return (
					agent.name?.toLowerCase().includes(query) ||
					agent.description?.toLowerCase().includes(query) ||
					agent.role?.toLowerCase().includes(query)
				);
			});
		}

		return filtered;
	});

	function addAgent(eventId: string) {
		if (!pendingAgentIds.includes(eventId)) {
			pendingAgentIds = [...pendingAgentIds, eventId];

			// If this is the first agent, make it PM
			if (pendingAgentIds.length === 1) {
				pendingPmId = eventId;
			}
		}
		showAddDialog = false;
		searchQuery = '';
	}

	function closeAddDialog() {
		showAddDialog = false;
		searchQuery = '';
	}

	function removeAgent(eventId: string) {
		pendingAgentIds = pendingAgentIds.filter(id => id !== eventId);

		// If removing the PM, clear PM selection
		if (pendingPmId === eventId) {
			pendingPmId = pendingAgentIds.length > 0 ? pendingAgentIds[0] : null;
		}
	}

	function setPM(eventId: string) {
		if (eventId === pendingPmId) return;

		// Move the selected agent to the front
		pendingAgentIds = [
			eventId,
			...pendingAgentIds.filter(id => id !== eventId)
		];
		pendingPmId = eventId;
	}

	async function handleSave() {
		if (!ndk.$currentUser || isSaving) return;

		isSaving = true;
		try {
			// Clear existing agent tags
			project.tags = project.tags.filter(tag => tag[0] !== 'agent');

			// Add agents in order (PM first)
			pendingAgentIds.forEach(id => {
				project.addAgent(id);
			});

			await project.publishReplaceable();
		} catch (error) {
			console.error('Failed to save agents:', error);
			alert('Failed to save changes. Please try again.');
		} finally {
			isSaving = false;
		}
	}

	function handleCancel() {
		// Reset to original state
		pendingAgentIds = [...originalAgentIds];
		pendingPmId = originalAgentIds.length > 0 ? originalAgentIds[0] : null;
	}
</script>

<div class="p-4">
	<div class="flex items-center justify-between mb-4">
		<div>
			<h2 class="text-lg font-semibold">Project Agents</h2>
			<p class="text-sm text-muted-foreground mt-1">
				Agents assigned to this project
			</p>
		</div>
		<button
			onclick={() => (showAddDialog = true)}
			disabled={isSaving}
			class="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
		>
			<Plus class="w-4 h-4" />
			Add Agent
		</button>
	</div>

	<div class="space-y-4">
		{#if pendingAgentIds.length === 0}
			<div class="text-sm text-muted-foreground p-4 border border-border rounded-lg bg-card text-center">
				No agents assigned to this project yet.
			</div>
		{:else}
			<div class="grid gap-4 md:grid-cols-2">
				{#each pendingAgentIds as eventId (eventId)}
					<AgentDefinitionItem
						eventId={eventId}
						isPM={eventId === pendingPmId}
						disabled={isSaving}
						onSetPM={() => setPM(eventId)}
						onRemove={() => removeAgent(eventId)}
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

<!-- Add Agent Dialog -->
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
					<h3 class="text-lg font-semibold">Add Agent to Project</h3>
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
						placeholder="Search agents by name, role, or description..."
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
				{#if availableAgents.length === 0}
					<div class="text-center text-muted-foreground p-8">
						<p>No available agent definitions found.</p>
						<p class="text-sm mt-2">All agents have been added to this project.</p>
					</div>
				{:else}
					<div class="grid gap-4 md:grid-cols-2">
						{#each availableAgents as agentEvent (agentEvent.id)}
							{@const agent = NDKAgentDefinition.from(agentEvent)}
							<AgentDefinitionCard
								{agent}
								onclick={() => addAgent(agentEvent.id)}
							/>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
