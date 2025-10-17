<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import type { NDKProject } from '$lib/events/NDKProject';
	import AgentDefinitionItem from './AgentDefinitionItem.svelte';

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

			await project.sign();
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
