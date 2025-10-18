<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ndk } from '$lib/ndk.svelte';
	import { NDKAgentDefinition } from '$lib/events/NDKAgentDefinition';
	import { NDKMCPTool } from '$lib/events/NDKMCPTool';
	import { generateAgentColor } from '$lib/utils/colors';
	import CreateAgentDialog from '$lib/components/dialogs/CreateAgentDialog.svelte';
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';
	import { ArrowLeft, Monitor, Copy, Check, GitFork, ClipboardCopy } from 'lucide-svelte';

	const agentId = $derived($page.params.id);

	const agentEvent = ndk.$fetchEvent(() => agentId);
	console.log('agent definition', (agentEvent as NDKAgentDefinition)?.description);

	const agent = $derived.by(() => {
		if (!agentEvent) return null;
		return NDKAgentDefinition.from(agentEvent);
	});

	const mcpEventIds = $derived(agent?.mcpServers || []);

	const mcpEventsSub = ndk.$fetchEvents(
		() => (mcpEventIds.length > 0 ? { ids: mcpEventIds } : undefined),
	);

	const mcpTools = $derived.by(() => {
		const events = mcpEventsSub || [];
		return events.map((event) => NDKMCPTool.from(event));
	});

	const agentColor = $derived(agent ? generateAgentColor(agent.name || agent.id) : '');
	const initials = $derived(agent?.name ? agent.name.slice(0, 2).toUpperCase() : 'AG');

	let activeTab = $state<'details' | 'phases'>('details');
	let forkDialogOpen = $state(false);
	let cloneDialogOpen = $state(false);
	let copiedId = $state(false);
	let actionsOpen = $state(false);

	let forkAgent = $state<NDKAgentDefinition | undefined>(undefined);
	let cloneMode = $state(false);

	async function handleCopyId() {
		if (!agent) return;
		try {
			await navigator.clipboard.writeText(agent.id);
			copiedId = true;
			setTimeout(() => (copiedId = false), 2000);
		} catch (error) {
			console.error('Failed to copy ID:', error);
		}
	}

	function handleFork() {
		if (agent) {
			forkAgent = agent;
			cloneMode = false;
			forkDialogOpen = true;
		}
		actionsOpen = false;
	}

	function handleClone() {
		if (agent) {
			forkAgent = agent;
			cloneMode = true;
			cloneDialogOpen = true;
		}
		actionsOpen = false;
	}

	function renderMarkdown(content: string): string {
		const rawHtml = marked(content, { breaks: true });
		return DOMPurify.sanitize(rawHtml);
	}
</script>

<div class="flex-1 flex flex-col">
	{#if !agent}
		<div class="flex-1 flex items-center justify-center bg-background">
			<div class="text-center">
				<Monitor class="w-12 h-12 text-muted-foreground mx-auto mb-4" />
				<h3 class="text-lg font-medium text-foreground mb-1">Agent definition not found</h3>
				<p class="text-sm text-muted-foreground mb-4">This agent definition could not be found.</p>
				<button
					onclick={() => goto('/agents')}
					class="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
				>
					Back to Agent Definitions
				</button>
			</div>
		</div>
	{:else}
		<!-- Header -->
		<div class="bg-card border-b border-border">
			<div class="max-w-4xl mx-auto px-4 py-4">
				<div class="flex items-center gap-4 mb-4">
					<button
						onclick={() => goto('/agents')}
						class="p-2 hover:bg-muted rounded-md transition-colors"
					>
						<ArrowLeft class="w-5 h-5 text-foreground" />
					</button>
					<div
						class="w-16 h-16 rounded-full flex items-center justify-center text-white font-semibold text-xl flex-shrink-0"
						style="background-color: {agentColor}"
					>
						{#if agent.picture}
							<img src={agent.picture} alt={agent.name} class="w-full h-full rounded-full object-cover" />
						{:else}
							{initials}
						{/if}
					</div>
					<div class="flex-1">
						<h1 class="text-2xl font-semibold text-foreground">
							{agent.name || 'Unnamed Agent Definition'}
						</h1>
						<div class="flex items-center gap-2 mt-1">
							{#if agent.role}
								<span class="px-2 py-1 text-xs bg-muted text-foreground rounded">{agent.role}</span>
							{/if}
							<button
								onclick={handleCopyId}
								class="text-xs text-muted-foreground hover:text-foreground dark:hover:text-muted-foreground font-mono flex items-center gap-1"
							>
								{agent.id.slice(0, 8)}...{agent.id.slice(-8)}
								{#if copiedId}
									<Check class="w-3 h-3 text-green-500" />
								{:else}
									<Copy class="w-3 h-3" />
								{/if}
							</button>
						</div>
					</div>
					<div class="relative">
						<button
							onclick={() => (actionsOpen = !actionsOpen)}
							class="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors flex items-center gap-2"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
							</svg>
							Actions
						</button>
						{#if actionsOpen}
							<div
								class="absolute right-0 mt-2 w-48 bg-card rounded-md shadow-lg border border-border z-10"
							>
								<button
									onclick={handleFork}
									class="w-full text-left px-4 py-2 text-foreground hover:bg-muted flex items-center gap-2"
								>
									<GitFork class="w-4 h-4" />
									Fork
								</button>
								<button
									onclick={handleClone}
									class="w-full text-left px-4 py-2 text-foreground hover:bg-muted flex items-center gap-2"
								>
									<ClipboardCopy class="w-4 h-4" />
									Clone
								</button>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>

		<!-- Tabs -->
		<div class="border-b border-border bg-card">
			<div class="max-w-4xl mx-auto px-4">
				<div class="flex gap-4">
					<button
						onclick={() => (activeTab = 'details')}
						class="px-4 py-3 border-b-2 {activeTab === 'details'
							? 'border-blue-600 text-primary'
							: 'border-transparent text-muted-foreground hover:text-foreground dark:hover:text-muted-foreground'} transition-colors"
					>
						Details
					</button>
					{#if agent.phases && agent.phases.length > 0}
						<button
							onclick={() => (activeTab = 'phases')}
							class="px-4 py-3 border-b-2 {activeTab === 'phases'
								? 'border-blue-600 text-primary'
								: 'border-transparent text-muted-foreground hover:text-foreground dark:hover:text-muted-foreground'} transition-colors"
						>
							Phases ({agent.phases.length})
						</button>
					{/if}
				</div>
			</div>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto bg-background">
			<div class="max-w-4xl mx-auto p-4 space-y-4">
				{#if activeTab === 'details'}
					<!-- Description -->
					<div class="bg-card rounded-lg border border-border p-6">
						<h3 class="font-semibold text-foreground mb-2">Description</h3>
						<p class="text-foreground">{agent.description || 'No description provided'}</p>
					</div>

					<!-- Instructions -->
					{#if agent.instructions}
						<div class="bg-card rounded-lg border border-border p-6">
							<h3 class="font-semibold text-foreground mb-2">Instructions</h3>
							<p class="text-sm text-muted-foreground mb-4">The prompt that defines this agent's behavior</p>
							<div class="prose prose-sm max-w-none dark:prose-invert">
								{@html renderMarkdown(agent.instructions)}
							</div>
						</div>
					{/if}

					<!-- Use Criteria -->
					{#if agent.useCriteria && agent.useCriteria.length > 0}
						<div class="bg-card rounded-lg border border-border p-6">
							<h3 class="font-semibold text-foreground mb-2">Use Criteria</h3>
							<p class="text-sm text-muted-foreground mb-4">When this agent should be used</p>
							<ul class="space-y-2">
								{#each agent.useCriteria as criteria}
									<li class="flex items-start gap-2">
										<span class="text-muted-foreground">•</span>
										<span class="text-foreground">{criteria}</span>
									</li>
								{/each}
							</ul>
						</div>
					{/if}

					<!-- Tools & MCP Servers -->
					<div class="bg-card rounded-lg border border-border p-6">
						<h3 class="font-semibold text-foreground mb-4">Tools & Capabilities</h3>

						<!-- Direct Tools -->
						<div class="mb-4">
							<div class="flex items-center gap-2 mb-2">
								<svg class="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
								<span class="text-sm font-medium text-foreground">Direct Tools</span>
							</div>
							{#if agent.tools.length > 0}
								<div class="flex flex-wrap gap-2">
									{#each agent.tools as tool}
										<span class="px-2 py-1 text-xs bg-muted text-foreground rounded border border-border dark:border-zinc-600">
											{tool}
										</span>
									{/each}
								</div>
							{:else}
								<p class="text-sm text-muted-foreground">No direct tools configured</p>
							{/if}
						</div>

						<!-- MCP Servers -->
						<div>
							<div class="flex items-center gap-2 mb-2">
								<svg class="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
									/>
								</svg>
								<span class="text-sm font-medium text-foreground">MCP Servers</span>
							</div>
							{#if mcpTools.length > 0}
								<div class="space-y-2">
									{#each mcpTools as mcp}
										<div class="border border-border dark:border-zinc-600 rounded-lg p-3 bg-muted dark:bg-zinc-800/50">
											<h4 class="font-medium text-sm text-foreground">
												{mcp.name || 'Unnamed MCP Server'}
											</h4>
											{#if mcp.description}
												<p class="text-xs text-muted-foreground mt-1">{mcp.description}</p>
											{/if}
											{#if mcp.command}
												<code class="text-xs bg-muted text-foreground px-2 py-0.5 rounded mt-2 inline-block"
													>{mcp.command}</code
												>
											{/if}
										</div>
									{/each}
								</div>
							{:else}
								<p class="text-sm text-muted-foreground">No MCP servers configured</p>
							{/if}
						</div>
					</div>

					<!-- Metadata -->
					<div class="bg-card rounded-lg border border-border p-6">
						<h3 class="font-semibold text-foreground mb-4">Metadata</h3>
						<div class="space-y-2 text-sm">
							<div class="flex justify-between">
								<span class="text-muted-foreground">Author:</span>
								<span class="font-mono text-foreground">{agent.pubkey.slice(0, 16)}...</span>
							</div>
							<div class="flex justify-between">
								<span class="text-muted-foreground">Created:</span>
								<span class="text-foreground">
									{agent.created_at ? new Date(agent.created_at * 1000).toLocaleString() : 'Unknown'}
								</span>
							</div>
							<div class="flex justify-between">
								<span class="text-muted-foreground">Event Kind:</span>
								<span class="text-foreground">{agent.kind}</span>
							</div>
							{#if agent.version}
								<div class="flex justify-between">
									<span class="text-muted-foreground">Version:</span>
									<span class="text-foreground">{agent.version}</span>
								</div>
							{/if}
						</div>
					</div>
				{:else if activeTab === 'phases' && agent.phases}
					<!-- Phases Tab -->
					<div class="space-y-4">
						{#each agent.phases as phase, index}
							<div class="bg-card rounded-lg border border-border p-6">
								<div class="flex items-center gap-2 mb-2">
									<span class="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">Phase {index + 1}</span>
									<h3 class="font-semibold text-foreground">{phase.name}</h3>
								</div>
								<div class="prose prose-sm max-w-none dark:prose-invert">
									{@html renderMarkdown(phase.instructions)}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

{#if forkAgent}
	<CreateAgentDialog bind:open={forkDialogOpen} {forkAgent} {cloneMode} />
{/if}

{#if forkAgent && cloneMode}
	<CreateAgentDialog bind:open={cloneDialogOpen} {forkAgent} {cloneMode} />
{/if}
