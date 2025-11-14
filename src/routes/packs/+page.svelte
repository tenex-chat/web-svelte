<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { NDKAgentDefinitionPack } from '$lib/events/NDKAgentDefinitionPack';
	import PackCard from '$lib/components/agents/PackCard.svelte';
	import CreatePackDialog from '$lib/components/dialogs/CreatePackDialog.svelte';
	import { goto } from '$app/navigation';
	import { Plus, Package, Monitor } from 'lucide-svelte';

	let searchQuery = $state('');
	let createDialogOpen = $state(false);

	const packSubscription = ndk.$subscribe(() => ({
		filters: [{ kinds: [34199] }],
		subId: 'agent-packs'
	}));

	const packs = $derived.by(() => {
		const events = packSubscription.events || [];
		return events.map((event) => NDKAgentDefinitionPack.from(event));
	});

	const filteredPacks = $derived.by(() => {
		if (!searchQuery) return packs;

		const query = searchQuery.toLowerCase();
		return packs.filter(
			(pack) =>
				pack.title?.toLowerCase().includes(query) ||
				pack.description?.toLowerCase().includes(query)
		);
	});

	function handlePackClick(pack: NDKAgentDefinitionPack) {
		const naddr = pack.encode();
		goto(`/packs/${naddr}`);
	}
</script>

<div class="flex-1 flex flex-col">
	<!-- Header -->
	<div class="bg-card border-b border-border">
		<div class="max-w-6xl mx-auto px-4 py-4">
			<div class="flex items-center justify-between mb-4">
				<div>
					<h1 class="text-2xl font-semibold text-foreground">Agent Packs</h1>
					<p class="text-sm text-muted-foreground mt-1">
						Curated collections of AI agents for specific workflows
					</p>
				</div>
				<div class="flex gap-2">
					<button
						onclick={() => goto('/agents')}
						class="inline-flex items-center px-4 py-2 border border-border text-foreground rounded-md hover:bg-muted transition-colors"
					>
						<Monitor class="w-4 h-4 mr-2" />
						Browse Agents
					</button>
					{#if ndk.$currentUser}
						<button
							onclick={() => (createDialogOpen = true)}
							class="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
						>
							<Plus class="w-4 h-4 mr-2" />
							Create Pack
						</button>
					{/if}
				</div>
			</div>

			<!-- Search -->
			<div class="flex gap-3">
				<div class="flex-1">
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Search packs by name or description..."
						class="w-full px-4 py-2 border border-border rounded-md bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>
			</div>
		</div>
	</div>

	<!-- Content -->
	<div class="flex-1 overflow-y-auto bg-background">
		<div class="max-w-6xl mx-auto p-4">
			{#if filteredPacks.length === 0}
				<div class="flex flex-col items-center justify-center py-12">
					<Package class="w-12 h-12 text-muted-foreground mb-4" />
					<h3 class="text-lg font-medium text-foreground mb-1">
						{searchQuery ? 'No packs found' : 'No agent packs yet'}
					</h3>
					<p class="text-sm text-muted-foreground">
						{searchQuery
							? 'Try adjusting your search query'
							: ndk.$currentUser
								? 'Create your first agent pack to get started'
								: 'Sign in to create and manage agent packs'}
					</p>
				</div>
			{:else}
				<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{#each filteredPacks as pack (pack.id)}
						<PackCard {pack} onclick={() => handlePackClick(pack)} />
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<CreatePackDialog bind:open={createDialogOpen} />
