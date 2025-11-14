<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ndk } from '$lib/ndk.svelte';
	import { NDKAgentDefinitionPack } from '$lib/events/NDKAgentDefinitionPack';
	import { NDKAgentDefinition } from '$lib/events/NDKAgentDefinition';
	import { generateAgentColor } from '$lib/utils/colors';
	import AgentDefinitionCard from '$lib/components/agents/AgentDefinitionCard.svelte';
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';
	import { ArrowLeft, Package, Copy, Check } from 'lucide-svelte';

	const packId = $derived($page.params.id);

	const packEvent = ndk.$fetchEvent(() => packId);

	const pack = $derived.by(() => {
		if (!packEvent) return null;
		return NDKAgentDefinitionPack.from(packEvent);
	});

	const agentIds = $derived(pack?.agentEventIds || []);

	const agentEventsSub = ndk.$fetchEvents(() =>
		agentIds.length > 0 ? { ids: agentIds } : undefined
	);

	const agents = $derived.by(() => {
		const events = agentEventsSub || [];
		return events.map((event) => NDKAgentDefinition.from(event));
	});

	const packColor = $derived(
		pack ? generateAgentColor(pack.id || pack.title || 'default') : ''
	);
	let copiedId = $state(false);

	async function handleCopyId() {
		if (!pack) return;
		try {
			await navigator.clipboard.writeText(pack.id);
			copiedId = true;
			setTimeout(() => (copiedId = false), 2000);
		} catch (error) {
			console.error('Failed to copy ID:', error);
		}
	}

	function handleAgentClick(agent: NDKAgentDefinition) {
		goto(`/agents/${agent.encode()}`);
	}

	function renderMarkdown(content: string): string {
		const rawHtml = marked(content, { breaks: true });
		return DOMPurify.sanitize(rawHtml);
	}

	async function handleAddToProject() {
		// TODO: Implement add to project functionality
		console.log('Add to project clicked');
	}
</script>

<div class="flex-1 flex flex-col">
	{#if !pack}
		<div class="flex-1 flex items-center justify-center bg-background">
			<div class="text-center">
				<Package class="w-12 h-12 text-muted-foreground mx-auto mb-4" />
				<h3 class="text-lg font-medium text-foreground mb-1">Pack not found</h3>
				<p class="text-sm text-muted-foreground mb-4">This agent pack could not be found.</p>
				<button
					onclick={() => goto('/packs')}
					class="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
				>
					Back to Packs
				</button>
			</div>
		</div>
	{:else}
		<!-- Header -->
		<div class="bg-card border-b border-border">
			<div class="max-w-4xl mx-auto px-4 py-4">
				<div class="flex items-center gap-4 mb-4">
					<button
						onclick={() => goto('/packs')}
						class="p-2 hover:bg-muted rounded-md transition-colors"
					>
						<ArrowLeft class="w-5 h-5 text-foreground" />
					</button>
					<div
						class="w-16 h-16 rounded-lg flex items-center justify-center text-white font-semibold text-xl flex-shrink-0"
						style="background-color: {packColor}"
					>
						{#if pack.image}
							<img
								src={`/api/proxy?url=${encodeURIComponent(pack.image)}`}
								alt={pack.title}
								class="w-full h-full rounded-lg object-cover"
								crossorigin="anonymous"
							/>
						{:else}
							<Package class="w-8 h-8" />
						{/if}
					</div>
					<div class="flex-1">
						<h1 class="text-2xl font-semibold text-foreground">
							{pack.title || 'Unnamed Pack'}
						</h1>
						<div class="flex items-center gap-2 mt-1">
							<span class="px-2 py-1 text-xs bg-primary/10 text-primary rounded">
								{pack.agentEventIds.length} Agent{pack.agentEventIds.length !== 1 ? 's' : ''}
							</span>
							<button
								onclick={handleCopyId}
								class="text-xs text-muted-foreground hover:text-foreground font-mono flex items-center gap-1"
							>
								{pack.id.slice(0, 8)}...{pack.id.slice(-8)}
								{#if copiedId}
									<Check class="w-3 h-3 text-green-500" />
								{:else}
									<Copy class="w-3 h-3" />
								{/if}
							</button>
						</div>
					</div>
					{#if ndk.$currentUser}
						<button
							onclick={handleAddToProject}
							class="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
						>
							Add to Project
						</button>
					{/if}
				</div>
			</div>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto bg-background">
			<div class="max-w-4xl mx-auto p-4 space-y-4">
				<!-- Description -->
				<div class="bg-card rounded-lg border border-border p-6">
					<h3 class="font-semibold text-foreground mb-2">Description</h3>
					{#if pack.description}
						<div class="prose prose-sm max-w-none dark:prose-invert">
							{@html renderMarkdown(pack.description)}
						</div>
					{:else}
						<p class="text-sm text-muted-foreground">No description provided</p>
					{/if}
				</div>

				<!-- Hashtags -->
				{#if pack.hashtags && pack.hashtags.length > 0}
					<div class="bg-card rounded-lg border border-border p-6">
						<h3 class="font-semibold text-foreground mb-2">Tags</h3>
						<div class="flex flex-wrap gap-2">
							{#each pack.hashtags as tag}
								<span class="px-2 py-1 text-xs bg-muted text-foreground rounded border border-border">
									#{tag}
								</span>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Agents in Pack -->
				<div class="bg-card rounded-lg border border-border p-6">
					<h3 class="font-semibold text-foreground mb-4">Agents in this Pack</h3>
					{#if agents.length === 0}
						<p class="text-sm text-muted-foreground">Loading agents...</p>
					{:else}
						<div class="grid gap-4 md:grid-cols-2">
							{#each agents as agent (agent.id)}
								<AgentDefinitionCard {agent} onclick={() => handleAgentClick(agent)} />
							{/each}
						</div>
					{/if}
				</div>

				<!-- Metadata -->
				<div class="bg-card rounded-lg border border-border p-6">
					<h3 class="font-semibold text-foreground mb-4">Metadata</h3>
					<div class="space-y-2 text-sm">
						<div class="flex justify-between">
							<span class="text-muted-foreground">Author:</span>
							<span class="font-mono text-foreground">{pack.pubkey.slice(0, 16)}...</span>
						</div>
						<div class="flex justify-between">
							<span class="text-muted-foreground">Created:</span>
							<span class="text-foreground">
								{pack.created_at ? new Date(pack.created_at * 1000).toLocaleString() : 'Unknown'}
							</span>
						</div>
						<div class="flex justify-between">
							<span class="text-muted-foreground">Event Kind:</span>
							<span class="text-foreground">{pack.kind}</span>
						</div>
						{#if pack.dTag}
							<div class="flex justify-between">
								<span class="text-muted-foreground">D-Tag:</span>
								<span class="text-foreground font-mono">{pack.dTag}</span>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
