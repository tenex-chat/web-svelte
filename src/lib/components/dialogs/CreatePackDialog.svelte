<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { NDKAgentDefinitionPack } from '$lib/events/NDKAgentDefinitionPack';
	import { NDKAgentDefinition } from '$lib/events/NDKAgentDefinition';
	import AgentDefinitionCard from '$lib/components/agents/AgentDefinitionCard.svelte';
	import { goto } from '$app/navigation';
	import { X, Check } from 'lucide-svelte';

	interface Props {
		open?: boolean;
	}

	let { open = $bindable(false) }: Props = $props();

	type WizardStep = 'basics' | 'agents' | 'review';

	let currentStep = $state<WizardStep>('basics');
	let creating = $state(false);

	let title = $state('');
	let description = $state('');
	let image = $state('');
	let hashtags = $state('');
	let selectedAgentIds = $state<Set<string>>(new Set());

	const agentSubscription = ndk.$subscribe(() => ({
		filters: [{ kinds: [NDKAgentDefinition.kind] }],
		subId: 'create-pack-agents'
	}));

	const agents = $derived.by(() => {
		const events = agentSubscription.events || [];
		return events.map((event) => NDKAgentDefinition.from(event));
	});

	$effect(() => {
		if (open) {
			currentStep = 'basics';
		}
	});

	function resetForm() {
		title = '';
		description = '';
		image = '';
		hashtags = '';
		selectedAgentIds = new Set();
		currentStep = 'basics';
	}

	function handleClose() {
		open = false;
		resetForm();
	}

	function toggleAgentSelection(agentId: string) {
		const newSet = new Set(selectedAgentIds);
		if (newSet.has(agentId)) {
			newSet.delete(agentId);
		} else {
			newSet.add(agentId);
		}
		selectedAgentIds = newSet;
	}

	async function handleCreate() {
		if (!ndk) {
			alert('NDK not initialized');
			return;
		}

		if (!ndk.$currentUser) {
			alert('Please login to create a pack');
			return;
		}

		creating = true;

		try {
			const pack = new NDKAgentDefinitionPack(ndk);

			pack.title = title;
			pack.description = description;
			if (image) pack.image = image;

			const tags = hashtags
				.split(',')
				.map((t) => t.trim())
				.filter((t) => t);
			if (tags.length > 0) pack.hashtags = tags;

			selectedAgentIds.forEach((agentId) => {
				const agentEvent = agents.find((a) => a.id === agentId);
				if (agentEvent) {
					pack.addAgent(agentEvent);
				}
			});

			await pack.sign();
			await pack.publish();

			alert('Pack created successfully!');
			handleClose();

			const naddr = pack.encode();
			goto(`/packs/${naddr}`);
		} catch (error) {
			console.error('Failed to create pack:', error);
			alert('Failed to create pack. Please try again.');
		} finally {
			creating = false;
		}
	}

	function nextStep() {
		if (currentStep === 'basics') currentStep = 'agents';
		else if (currentStep === 'agents') currentStep = 'review';
	}

	function prevStep() {
		if (currentStep === 'review') currentStep = 'agents';
		else if (currentStep === 'agents') currentStep = 'basics';
	}

	const canProceed = $derived.by(() => {
		if (currentStep === 'basics') return title.trim().length > 0;
		if (currentStep === 'agents') return selectedAgentIds.size > 0;
		return true;
	});
</script>

{#if open}
	<div class="fixed inset-0 bg-overlay/50 flex items-center justify-center z-50 p-4">
		<div class="bg-card rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col border border-border">
			<!-- Header -->
			<div class="flex items-center justify-between p-6 border-b border-border">
				<div>
					<h2 class="text-2xl font-semibold text-foreground">Create Agent Pack</h2>
					<p class="text-sm text-muted-foreground mt-1">
						{currentStep === 'basics'
							? 'Basic information about your pack'
							: currentStep === 'agents'
								? 'Select agents to include'
								: 'Review and publish'}
					</p>
				</div>
				<button
					onclick={handleClose}
					class="p-2 hover:bg-muted rounded-md transition-colors"
					disabled={creating}
				>
					<X class="w-5 h-5 text-foreground" />
				</button>
			</div>

			<!-- Progress Indicator -->
			<div class="flex items-center gap-2 px-6 py-4 border-b border-border bg-muted/30">
				<div class="flex items-center gap-2">
					<div
						class="w-8 h-8 rounded-full flex items-center justify-center {currentStep === 'basics'
							? 'bg-primary text-primary-foreground'
							: 'bg-muted text-muted-foreground'}"
					>
						1
					</div>
					<span class="text-sm font-medium {currentStep === 'basics' ? 'text-foreground' : 'text-muted-foreground'}">Basics</span>
				</div>
				<div class="flex-1 h-0.5 bg-border"></div>
				<div class="flex items-center gap-2">
					<div
						class="w-8 h-8 rounded-full flex items-center justify-center {currentStep === 'agents'
							? 'bg-primary text-primary-foreground'
							: 'bg-muted text-muted-foreground'}"
					>
						2
					</div>
					<span class="text-sm font-medium {currentStep === 'agents' ? 'text-foreground' : 'text-muted-foreground'}">Agents</span>
				</div>
				<div class="flex-1 h-0.5 bg-border"></div>
				<div class="flex items-center gap-2">
					<div
						class="w-8 h-8 rounded-full flex items-center justify-center {currentStep === 'review'
							? 'bg-primary text-primary-foreground'
							: 'bg-muted text-muted-foreground'}"
					>
						3
					</div>
					<span class="text-sm font-medium {currentStep === 'review' ? 'text-foreground' : 'text-muted-foreground'}">Review</span>
				</div>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto p-6">
				{#if currentStep === 'basics'}
					<div class="space-y-4 max-w-2xl">
						<!-- Title -->
						<div>
							<label class="block text-sm font-medium text-foreground mb-2">
								Pack Title <span class="text-red-500">*</span>
							</label>
							<input
								type="text"
								bind:value={title}
								placeholder="e.g., Web Development Pack"
								class="w-full px-4 py-2 border border-border rounded-md bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
							/>
						</div>

						<!-- Description -->
						<div>
							<label class="block text-sm font-medium text-foreground mb-2"> Description </label>
							<textarea
								bind:value={description}
								placeholder="Describe what this pack is for and when to use it..."
								rows={4}
								class="w-full px-4 py-2 border border-border rounded-md bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
							></textarea>
						</div>

						<!-- Image URL -->
						<div>
							<label class="block text-sm font-medium text-foreground mb-2"> Cover Image URL </label>
							<input
								type="text"
								bind:value={image}
								placeholder="https://example.com/image.jpg"
								class="w-full px-4 py-2 border border-border rounded-md bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
							/>
						</div>

						<!-- Hashtags -->
						<div>
							<label class="block text-sm font-medium text-foreground mb-2">
								Hashtags
								<span class="text-xs text-muted-foreground font-normal">(comma-separated)</span>
							</label>
							<input
								type="text"
								bind:value={hashtags}
								placeholder="web-dev, frontend, fullstack"
								class="w-full px-4 py-2 border border-border rounded-md bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
							/>
						</div>
					</div>
				{:else if currentStep === 'agents'}
					<div class="space-y-4">
						<p class="text-sm text-muted-foreground">
							Select the agents you want to include in this pack. You've selected{' '}
							{selectedAgentIds.size} agent{selectedAgentIds.size !== 1 ? 's' : ''}.
						</p>
						{#if agents.length === 0}
							<p class="text-sm text-muted-foreground">Loading agents...</p>
						{:else}
							<div class="grid gap-4 md:grid-cols-2">
								{#each agents as agent (agent.id)}
									<button
										onclick={() => toggleAgentSelection(agent.id)}
										class="text-left relative"
									>
										<AgentDefinitionCard {agent} />
										{#if selectedAgentIds.has(agent.id)}
											<div
												class="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center"
											>
												<Check class="w-4 h-4 text-primary-foreground" />
											</div>
										{/if}
									</button>
								{/each}
							</div>
						{/if}
					</div>
				{:else if currentStep === 'review'}
					<div class="space-y-4 max-w-2xl">
						<div class="bg-muted/50 rounded-lg p-6 space-y-4">
							<div>
								<h3 class="text-sm font-medium text-muted-foreground mb-1">Title</h3>
								<p class="text-foreground">{title}</p>
							</div>
							{#if description}
								<div>
									<h3 class="text-sm font-medium text-muted-foreground mb-1">Description</h3>
									<p class="text-foreground">{description}</p>
								</div>
							{/if}
							{#if image}
								<div>
									<h3 class="text-sm font-medium text-muted-foreground mb-1">Cover Image</h3>
									<img
										src={`/api/proxy?url=${encodeURIComponent(image)}`}
										alt="Pack cover"
										class="w-32 h-32 rounded-lg object-cover"
										crossorigin="anonymous"
									/>
								</div>
							{/if}
							{#if hashtags}
								<div>
									<h3 class="text-sm font-medium text-muted-foreground mb-1">Hashtags</h3>
									<p class="text-foreground">{hashtags}</p>
								</div>
							{/if}
							<div>
								<h3 class="text-sm font-medium text-muted-foreground mb-1">Agents</h3>
								<p class="text-foreground">{selectedAgentIds.size} agent{selectedAgentIds.size !== 1 ? 's' : ''} selected</p>
							</div>
						</div>
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="flex items-center justify-between p-6 border-t border-border">
				<button
					onclick={currentStep === 'basics' ? handleClose : prevStep}
					disabled={creating}
					class="px-4 py-2 text-foreground hover:bg-muted rounded-md transition-colors disabled:opacity-50"
				>
					{currentStep === 'basics' ? 'Cancel' : 'Back'}
				</button>
				<div class="flex gap-2">
					{#if currentStep === 'review'}
						<button
							onclick={handleCreate}
							disabled={creating || !canProceed}
							class="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
						>
							{creating ? 'Creating...' : 'Create Pack'}
						</button>
					{:else}
						<button
							onclick={nextStep}
							disabled={!canProceed}
							class="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
						>
							Next
						</button>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
